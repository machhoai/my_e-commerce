import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { EventDoc, VoucherCampaign, VoucherCode, AuditLogDoc, PrizePoolEntry } from '@/types';
import { todayVN } from '@/lib/event-engine';

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

// ── GET /api/events ─────────────────────────────────────────────
// Returns events with joined campaign info + stock counts per campaign
export async function GET(req: NextRequest) {
    try {
        const caller = await verifyAdmin(req);
        if (!caller) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const adminDb = getAdminDb();

        const [eventSnap, campaignSnap, codeSnap, auditSnap] = await Promise.all([
            adminDb.collection('events').orderBy('createdAt', 'desc').get(),
            adminDb.collection('voucher_campaigns').get(),
            adminDb.collection('voucher_codes').get(),
            adminDb.collection('audit_logs').orderBy('timestamp', 'desc').limit(200).get(),
        ]);

        const campaigns = campaignSnap.docs.map(d => ({ id: d.id, ...d.data() } as VoucherCampaign));
        const codes = codeSnap.docs.map(d => ({ id: d.id, ...d.data() } as VoucherCode));

        const events = eventSnap.docs.map(d => {
            const evt = { id: d.id, ...d.data() } as EventDoc;

            // Aggregate stats across all campaigns in prizePool
            const poolCampaignIds = (evt.prizePool || []).map(p => p.campaignId);
            const eventCodes = codes.filter(c => poolCampaignIds.includes(c.campaignId));

            // Build campaign names string
            const campaignNames = (evt.prizePool || []).map(p => {
                const camp = campaigns.find(c => c.id === p.campaignId);
                return camp?.name || p.campaignId;
            }).join(', ');

            return {
                ...evt,
                campaignNames,
                totalStock: eventCodes.length,
                codesAvailable: eventCodes.filter(c => c.status === 'available').length,
                codesDistributed: eventCodes.filter(c => c.status === 'distributed').length,
                codesUsed: eventCodes.filter(c => c.status === 'used').length,
                codesRevoked: eventCodes.filter(c => c.status === 'revoked').length,
                // Per-campaign stock details for dashboard
                campaignStocks: (evt.prizePool || []).map(p => {
                    const camp = campaigns.find(c => c.id === p.campaignId);
                    const campCodes = codes.filter(c => c.campaignId === p.campaignId);
                    return {
                        campaignId: p.campaignId,
                        campaignName: camp?.name || p.campaignId,
                        rewardType: p.rewardType,
                        rate: p.rate,
                        dailyLimit: p.dailyLimit,
                        totalStock: camp?.totalIssued || 0,
                        available: campCodes.filter(c => c.status === 'available').length,
                        distributed: campCodes.filter(c => c.status === 'distributed').length,
                    };
                }),
            };
        });

        // All active campaigns (available for selection)
        const activeCampaigns = campaigns.filter(c => c.status === 'active');

        const auditLogs = auditSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogDoc));

        return NextResponse.json({ events, campaigns: activeCampaigns, auditLogs });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ── POST /api/events ────────────────────────────────────────────
// Create a new event with a prize pool of multiple campaigns
export async function POST(req: NextRequest) {
    try {
        const caller = await verifyAdmin(req);
        if (!caller) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as {
            name: string;
            startDate: string;
            endDate: string;
            prizePool: PrizePoolEntry[];
        };

        // Basic validation
        if (!body.name?.trim()) return NextResponse.json({ error: 'Tên sự kiện là bắt buộc' }, { status: 400 });
        if (!body.startDate || !body.endDate) return NextResponse.json({ error: 'Ngày bắt đầu và kết thúc là bắt buộc' }, { status: 400 });
        if (body.startDate > body.endDate) return NextResponse.json({ error: 'Ngày bắt đầu phải trước ngày kết thúc' }, { status: 400 });
        if (!body.prizePool?.length) return NextResponse.json({ error: 'Vui lòng chọn ít nhất 1 chiến dịch' }, { status: 400 });

        // Validation 1: Sum of rates ≤ 100
        const totalRate = body.prizePool.reduce((sum, p) => sum + (p.rate || 0), 0);
        if (totalRate > 100) {
            return NextResponse.json({ error: `Tổng tỉ lệ trúng (${totalRate}%) vượt quá 100%` }, { status: 400 });
        }

        const adminDb = getAdminDb();

        // Validate each campaign + stock check
        const startMs = new Date(body.startDate).getTime();
        const endMs = new Date(body.endDate).getTime();
        const totalDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

        for (const entry of body.prizePool) {
            const campSnap = await adminDb.collection('voucher_campaigns').doc(entry.campaignId).get();
            if (!campSnap.exists) {
                return NextResponse.json({ error: `Chiến dịch ${entry.campaignId} không tồn tại` }, { status: 404 });
            }
            const camp = campSnap.data() as VoucherCampaign;

            // Validation 2: dailyLimit × days ≤ totalIssued
            const maxIssuance = (entry.dailyLimit || 0) * totalDays;
            if (maxIssuance > camp.totalIssued) {
                return NextResponse.json({
                    error: `Chiến dịch "${camp.name}": ${entry.dailyLimit}/ngày × ${totalDays} ngày = ${maxIssuance} > tổng mã ${camp.totalIssued}`,
                }, { status: 400 });
            }

            // Denormalize campaign info
            entry.campaignName = camp.name;
            entry.rewardType = camp.rewardType;
        }

        // Determine initial status
        const today = todayVN();
        let status: EventDoc['status'] = 'upcoming';
        if (today >= body.startDate && today <= body.endDate) status = 'active';
        if (today > body.endDate) status = 'ended';

        const now = new Date().toISOString();
        const eventRef = adminDb.collection('events').doc();
        const eventDoc: EventDoc = {
            id: eventRef.id,
            name: body.name.trim(),
            prizePool: body.prizePool,
            startDate: body.startDate,
            endDate: body.endDate,
            status,
            dailyStats: {},
            createdBy: caller.uid,
            createdAt: now,
        };

        // Write event + audit log in batch
        const batch = adminDb.batch();
        batch.set(eventRef, eventDoc);

        const campaignNamesList = body.prizePool.map(p => p.campaignName).join(', ');
        const auditRef = adminDb.collection('audit_logs').doc();
        const auditDoc: AuditLogDoc = {
            id: auditRef.id,
            action: 'CREATE_EVENT',
            actor: caller.uid,
            actorName: caller.name,
            timestamp: now,
            targetId: eventRef.id,
            details: `Tạo sự kiện "${body.name}" với ${body.prizePool.length} chiến dịch: ${campaignNamesList}`,
        };
        batch.set(auditRef, auditDoc);

        await batch.commit();

        return NextResponse.json({
            success: true,
            eventId: eventRef.id,
            message: `Đã tạo sự kiện "${body.name}" thành công với ${body.prizePool.length} chiến dịch.`,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ── PATCH /api/events ───────────────────────────────────────────
// Update event status (close, activate, etc.)
export async function PATCH(req: NextRequest) {
    try {
        const caller = await verifyAdmin(req);
        if (!caller) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as { eventId: string; status: EventDoc['status'] };
        if (!body.eventId || !body.status) {
            return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
        }

        const adminDb = getAdminDb();
        const eventRef = adminDb.collection('events').doc(body.eventId);
        const eventSnap = await eventRef.get();
        if (!eventSnap.exists) {
            return NextResponse.json({ error: 'Sự kiện không tồn tại' }, { status: 404 });
        }

        const now = new Date().toISOString();
        const batch = adminDb.batch();
        batch.update(eventRef, { status: body.status });

        const auditRef = adminDb.collection('audit_logs').doc();
        batch.set(auditRef, {
            id: auditRef.id,
            action: 'UPDATE_EVENT',
            actor: caller.uid,
            actorName: caller.name,
            timestamp: now,
            targetId: body.eventId,
            details: `Cập nhật trạng thái sự kiện thành "${body.status}"`,
        });

        await batch.commit();

        return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
