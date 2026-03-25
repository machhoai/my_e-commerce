import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { VoucherCode } from '@/types';

// ── Auth helper ─────────────────────────────────────────────────
async function verifyAdmin(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const decoded = await getAdminAuth().verifyIdToken(token);
    const adminDb = getAdminDb();
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists || !['admin', 'super_admin'].includes(callerSnap.data()?.role)) return null;
    return { uid: decoded.uid, name: callerSnap.data()?.name || 'Admin' };
}

// ── GET /api/events/vouchers ────────────────────────────────────
// Paginated voucher listing for an event's campaigns
// Query params: eventId (required), pageSize, lastDocId, campaignId, status
export async function GET(req: NextRequest) {
    try {
        const caller = await verifyAdmin(req);
        if (!caller) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get('eventId');
        const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10), 1), 100);
        const lastDocId = searchParams.get('lastDocId') || undefined;
        const filterCampaignId = searchParams.get('campaignId') || undefined;
        const filterStatus = searchParams.get('status') || undefined;

        if (!eventId) {
            return NextResponse.json({ error: 'eventId là bắt buộc' }, { status: 400 });
        }

        const adminDb = getAdminDb();

        // Get the event to know which campaigns are in its pool
        const eventSnap = await adminDb.collection('events').doc(eventId).get();
        if (!eventSnap.exists) {
            return NextResponse.json({ error: 'Sự kiện không tồn tại' }, { status: 404 });
        }
        const eventData = eventSnap.data()!;
        const poolCampaignIds = (eventData.prizePool || []).map((p: { campaignId: string }) => p.campaignId);

        if (poolCampaignIds.length === 0) {
            return NextResponse.json({ vouchers: [], lastDocId: null, hasMore: false });
        }

        // Determine which campaign(s) to query
        const targetCampaignIds = filterCampaignId
            ? poolCampaignIds.filter((id: string) => id === filterCampaignId)
            : poolCampaignIds;

        if (targetCampaignIds.length === 0) {
            return NextResponse.json({ vouchers: [], lastDocId: null, hasMore: false });
        }

        // Build query — Firestore 'in' supports up to 30 values
        let q: FirebaseFirestore.Query = adminDb.collection('voucher_codes');

        if (targetCampaignIds.length === 1) {
            q = q.where('campaignId', '==', targetCampaignIds[0]);
        } else {
            // Chunk if > 30 (unlikely for prize pools but safe)
            const chunk = targetCampaignIds.slice(0, 30);
            q = q.where('campaignId', 'in', chunk);
        }

        if (filterStatus) {
            q = q.where('status', '==', filterStatus);
        }

        // Order by doc ID for stable cursor pagination
        q = q.orderBy('__name__');

        // Cursor: start after the last document
        if (lastDocId) {
            const lastDocRef = adminDb.collection('voucher_codes').doc(lastDocId);
            const lastDocSnap = await lastDocRef.get();
            if (lastDocSnap.exists) {
                q = q.startAfter(lastDocSnap);
            }
        }

        // Fetch one extra to detect if there are more pages
        const snapshot = await q.limit(pageSize + 1).get();
        const hasMore = snapshot.docs.length > pageSize;
        const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

        const vouchers = docs.map(d => ({ id: d.id, ...d.data() })) as (VoucherCode & { usedByStaffName?: string })[];

        // Enrich with staff names for used vouchers
        const staffIds = [...new Set(vouchers.map(v => v.usedByStaffId).filter(Boolean))] as string[];
        if (staffIds.length > 0) {
            const staffMap = new Map<string, string>();
            for (let i = 0; i < staffIds.length; i += 30) {
                const chunk = staffIds.slice(i, i + 30);
                const snap = await adminDb.collection('users').where('__name__', 'in', chunk).select('name').get();
                snap.docs.forEach(d => staffMap.set(d.id, d.data().name || d.id));
            }
            vouchers.forEach(v => {
                if (v.usedByStaffId && staffMap.has(v.usedByStaffId)) {
                    v.usedByStaffName = staffMap.get(v.usedByStaffId);
                }
            });
        }

        return NextResponse.json({
            vouchers,
            lastDocId: docs.length > 0 ? docs[docs.length - 1].id : null,
            hasMore,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
