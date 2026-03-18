import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { generateSecureCode } from '@/lib/utils';
import type { VoucherCampaign, VoucherCode, VoucherRewardType } from '@/types';

// ── Auth helper ─────────────────────────────────────────────────
async function verifyAdmin(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const decoded = await getAdminAuth().verifyIdToken(token);
    const adminDb = getAdminDb();
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists || !['admin', 'super_admin'].includes(callerSnap.data()?.role)) return null;
    return decoded.uid;
}

// ── GET /api/vouchers ───────────────────────────────────────────
// Returns { campaigns: VoucherCampaign[], codes: VoucherCode[] }
export async function GET(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const adminDb = getAdminDb();

        const [campaignSnap, codeSnap] = await Promise.all([
            adminDb.collection('voucher_campaigns').orderBy('createdAt', 'desc').get(),
            adminDb.collection('voucher_codes').get(),
        ]);

        const campaigns = campaignSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const codes = codeSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return NextResponse.json({ campaigns, codes });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ── POST /api/vouchers ──────────────────────────────────────────
// Creates a campaign + batch-generates voucher codes
export async function POST(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as {
            name: string;
            description: string;
            rewardType: VoucherRewardType;
            rewardValue: number;
            validFrom: string;
            validTo: string;
            prefix: string;
            codeLength: number;
            suffix: string;
            quantity: number;
        };

        // Validation
        if (!body.name?.trim()) return NextResponse.json({ error: 'Tên chiến dịch là bắt buộc' }, { status: 400 });
        if (!body.rewardType) return NextResponse.json({ error: 'Loại thưởng là bắt buộc' }, { status: 400 });
        if (!body.quantity || body.quantity < 1 || body.quantity > 10000) {
            return NextResponse.json({ error: 'Số lượng mã phải từ 1 đến 10.000' }, { status: 400 });
        }
        if (!body.codeLength || body.codeLength < 4 || body.codeLength > 12) {
            return NextResponse.json({ error: 'Độ dài mã ngẫu nhiên phải từ 4 đến 12' }, { status: 400 });
        }

        const adminDb = getAdminDb();
        const now = new Date().toISOString();

        // 1. Create campaign document
        const campaignRef = adminDb.collection('voucher_campaigns').doc();
        const campaignDoc: VoucherCampaign = {
            id: campaignRef.id,
            name: body.name.trim(),
            description: body.description?.trim() || '',
            rewardType: body.rewardType,
            rewardValue: body.rewardValue || 0,
            validFrom: body.validFrom,
            validTo: body.validTo,
            prefix: body.prefix?.toUpperCase().trim() || '',
            codeLength: body.codeLength,
            suffix: body.suffix?.toUpperCase().trim() || '',
            totalIssued: body.quantity,
            status: 'active',
            createdAt: now,
            createdBy: callerUid,
        };
        await campaignRef.set(campaignDoc);

        // 2. Batch-generate voucher codes (chunked at 500 per Firestore limit)
        const generatedCodes = new Set<string>();
        const codeDocuments: VoucherCode[] = [];

        for (let i = 0; i < body.quantity; i++) {
            let code: string;
            let attempts = 0;
            do {
                const random = generateSecureCode(body.codeLength);
                const parts = [body.prefix, random, body.suffix].filter(Boolean);
                code = parts.join('-');
                attempts++;
            } while (generatedCodes.has(code) && attempts < 10);

            generatedCodes.add(code);
            codeDocuments.push({
                id: code,
                campaignId: campaignRef.id,
                campaignName: body.name.trim(),
                rewardType: body.rewardType,
                rewardValue: body.rewardValue || 0,
                validTo: body.validTo,
                status: 'available',
                distributedToPhone: null,
                distributedAt: null,
                usedAt: null,
                usedByStaffId: null,
            });
        }

        // Chunk into batches of 500 (Firestore limit)
        const BATCH_LIMIT = 500;
        for (let i = 0; i < codeDocuments.length; i += BATCH_LIMIT) {
            const chunk = codeDocuments.slice(i, i + BATCH_LIMIT);
            const batch = adminDb.batch();
            for (const codeDoc of chunk) {
                const codeRef = adminDb.collection('voucher_codes').doc(codeDoc.id);
                batch.set(codeRef, codeDoc);
            }
            await batch.commit();
        }

        return NextResponse.json({
            success: true,
            campaignId: campaignRef.id,
            totalGenerated: codeDocuments.length,
            message: `Đã tạo chiến dịch "${body.name}" với ${codeDocuments.length} mã voucher.`,
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ── PATCH /api/vouchers ─────────────────────────────────────────
// Revoke one or many voucher codes (bulk support)
export async function PATCH(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as { codeId?: string; codeIds?: string[]; action: 'revoke' };

        // Normalize to array
        const ids: string[] = body.codeIds?.length ? body.codeIds : body.codeId ? [body.codeId] : [];
        if (ids.length === 0) return NextResponse.json({ error: 'Thiếu mã voucher' }, { status: 400 });
        if (ids.length > 500) return NextResponse.json({ error: 'Tối đa 500 mã mỗi lần' }, { status: 400 });

        const adminDb = getAdminDb();
        const skipped: string[] = [];
        const revoked: string[] = [];

        // Batch writes (already within 500 limit)
        const batch = adminDb.batch();
        for (const id of ids) {
            const codeRef = adminDb.collection('voucher_codes').doc(id);
            const codeSnap = await codeRef.get();
            if (!codeSnap.exists) { skipped.push(id); continue; }
            const status = (codeSnap.data() as VoucherCode).status;
            if (status === 'used' || status === 'revoked') { skipped.push(id); continue; }
            batch.update(codeRef, { status: 'revoked' });
            revoked.push(id);
        }

        if (revoked.length > 0) await batch.commit();

        return NextResponse.json({
            success: true,
            revoked: revoked.length,
            skipped: skipped.length,
            message: `Đã vô hiệu hóa ${revoked.length} mã${skipped.length > 0 ? `, bỏ qua ${skipped.length} mã` : ''}.`,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
