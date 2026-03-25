import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { generateSecureCode } from '@/lib/utils';
import {
    getAllCampaignStats,
    getGlobalVoucherStats,
    getVouchersPaginated,
    findVouchersByPhone,
} from '@/lib/firebase/voucher-queries';
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
// Modes: stats | codes | phone
// - ?mode=stats → campaigns + aggregate counts (zero doc reads)
// - ?mode=codes&campaignId=X&status=Y&after=DOC_ID&pageSize=50 → paginated codes
// - ?mode=phone&phone=0901234567 → indexed phone lookup
export async function GET(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('mode') || 'stats';
        const adminDb = getAdminDb();

        // ── Mode: stats (default) ──────────────────────────────
        if (mode === 'stats') {
            const campaignSnap = await adminDb.collection('voucher_campaigns')
                .orderBy('createdAt', 'desc').get();
            const campaigns = campaignSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const campaignIds = campaigns.map(c => c.id);

            const [campaignStats, globalStats] = await Promise.all([
                getAllCampaignStats(campaignIds),
                getGlobalVoucherStats(),
            ]);

            return NextResponse.json({ campaigns, campaignStats, globalStats });
        }

        // ── Mode: codes (paginated) ────────────────────────────
        if (mode === 'codes') {
            const result = await getVouchersPaginated({
                campaignId: searchParams.get('campaignId') || undefined,
                status: searchParams.get('status') || undefined,
                search: searchParams.get('search') || undefined,
                lastDocId: searchParams.get('after') || undefined,
                pageSize: Math.min(Number(searchParams.get('pageSize')) || 50, 100),
            });
            return NextResponse.json(result);
        }

        // ── Mode: phone (indexed lookup) ───────────────────────
        if (mode === 'phone') {
            const phone = searchParams.get('phone');
            if (!phone) return NextResponse.json({ error: 'Thiếu số điện thoại' }, { status: 400 });
            const codes = await findVouchersByPhone(phone, 20);
            return NextResponse.json({ codes });
        }

        return NextResponse.json({ error: 'Mode không hợp lệ' }, { status: 400 });
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
            purpose?: 'print' | 'event';
            imageUrl?: string;   // Firebase Storage URL (optional)
        };

        // Validation
        if (!body.name?.trim()) return NextResponse.json({ error: 'Tên chiến dịch là bắt buộc' }, { status: 400 });
        if (!body.rewardType) return NextResponse.json({ error: 'Loại thưởng là bắt buộc' }, { status: 400 });
        if (!body.quantity || body.quantity < 1 || body.quantity > 1000000) {
            return NextResponse.json({ error: 'Số lượng mã phải từ 1 đến 1.000.000' }, { status: 400 });
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
            purpose: body.purpose || 'event',
            ...(body.imageUrl ? { image: body.imageUrl } : {}),
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
// Actions: revoke | add_codes | deactivate_campaign | activate_campaign
export async function PATCH(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as {
            action: 'revoke' | 'add_codes' | 'update_expiry' | 'deactivate_campaign' | 'activate_campaign';
            codeId?: string;
            codeIds?: string[];
            campaignId?: string;
            quantity?: number;
            validTo?: string; // ISO date for update_expiry
        };

        const adminDb = getAdminDb();

        // ── Action: revoke ──────────────────────────────────────
        if (body.action === 'revoke') {
            const ids: string[] = body.codeIds?.length ? body.codeIds : body.codeId ? [body.codeId] : [];
            if (ids.length === 0) return NextResponse.json({ error: 'Thiếu mã voucher' }, { status: 400 });
            if (ids.length > 500) return NextResponse.json({ error: 'Tối đa 500 mã mỗi lần' }, { status: 400 });

            const skipped: string[] = [];
            const revoked: string[] = [];
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
        }

        // ── Action: add_codes ───────────────────────────────────
        if (body.action === 'add_codes') {
            if (!body.campaignId) return NextResponse.json({ error: 'Thiếu campaignId' }, { status: 400 });
            const qty = body.quantity || 0;
            if (qty < 1 || qty > 1000000) return NextResponse.json({ error: 'Số lượng phải từ 1 đến 1.000.000' }, { status: 400 });

            const campRef = adminDb.collection('voucher_campaigns').doc(body.campaignId);
            const campSnap = await campRef.get();
            if (!campSnap.exists) return NextResponse.json({ error: 'Chiến dịch không tồn tại' }, { status: 404 });

            const camp = campSnap.data() as VoucherCampaign;
            const generatedCodes = new Set<string>();
            const codeDocuments: VoucherCode[] = [];

            // Fetch existing code IDs for this campaign to avoid duplicates
            const existingSnap = await adminDb.collection('voucher_codes')
                .where('campaignId', '==', body.campaignId).select().get();
            existingSnap.docs.forEach(d => generatedCodes.add(d.id));

            for (let i = 0; i < qty; i++) {
                let code: string;
                let attempts = 0;
                do {
                    const random = generateSecureCode(camp.codeLength || 6);
                    const parts = [camp.prefix, random, camp.suffix].filter(Boolean);
                    code = parts.join('-');
                    attempts++;
                } while (generatedCodes.has(code) && attempts < 10);

                generatedCodes.add(code);
                codeDocuments.push({
                    id: code,
                    campaignId: body.campaignId,
                    campaignName: camp.name,
                    rewardType: camp.rewardType,
                    rewardValue: camp.rewardValue || 0,
                    validTo: camp.validTo,
                    status: 'available',
                    distributedToPhone: null,
                    distributedAt: null,
                    usedAt: null,
                    usedByStaffId: null,
                });
            }

            // Batch write codes (chunked at 500)
            const BATCH_LIMIT = 500;
            for (let i = 0; i < codeDocuments.length; i += BATCH_LIMIT) {
                const chunk = codeDocuments.slice(i, i + BATCH_LIMIT);
                const batch = adminDb.batch();
                for (const codeDoc of chunk) {
                    batch.set(adminDb.collection('voucher_codes').doc(codeDoc.id), codeDoc);
                }
                await batch.commit();
            }

            // Update totalIssued on campaign
            await campRef.update({ totalIssued: (camp.totalIssued || 0) + codeDocuments.length });

            return NextResponse.json({
                success: true,
                totalGenerated: codeDocuments.length,
                newTotal: (camp.totalIssued || 0) + codeDocuments.length,
                message: `Đã tạo thêm ${codeDocuments.length} mã cho chiến dịch "${camp.name}".`,
            });
        }

        // ── Action: update_expiry ────────────────────────────────
        if (body.action === 'update_expiry') {
            if (!body.campaignId) return NextResponse.json({ error: 'Thiếu campaignId' }, { status: 400 });
            if (!body.validTo) return NextResponse.json({ error: 'Thiếu ngày hết hạn mới' }, { status: 400 });

            const campRef = adminDb.collection('voucher_campaigns').doc(body.campaignId);
            const campSnap = await campRef.get();
            if (!campSnap.exists) return NextResponse.json({ error: 'Chiến dịch không tồn tại' }, { status: 404 });

            const camp = campSnap.data() as VoucherCampaign;

            // Update campaign validTo
            await campRef.update({ validTo: body.validTo });

            // Update validTo on all non-used, non-revoked codes
            const codesSnap = await adminDb.collection('voucher_codes')
                .where('campaignId', '==', body.campaignId)
                .where('status', 'in', ['available', 'distributed'])
                .get();

            const BATCH_LIMIT = 500;
            for (let i = 0; i < codesSnap.docs.length; i += BATCH_LIMIT) {
                const chunk = codesSnap.docs.slice(i, i + BATCH_LIMIT);
                const batch = adminDb.batch();
                for (const doc of chunk) {
                    batch.update(doc.ref, { validTo: body.validTo });
                }
                await batch.commit();
            }

            return NextResponse.json({
                success: true,
                updatedCodes: codesSnap.size,
                message: `Đã gia hạn chiến dịch "${camp.name}" đến ${body.validTo}. Cập nhật ${codesSnap.size} mã.`,
            });
        }

        // ── Action: deactivate_campaign ─────────────────────────
        if (body.action === 'deactivate_campaign') {
            if (!body.campaignId) return NextResponse.json({ error: 'Thiếu campaignId' }, { status: 400 });
            const campRef = adminDb.collection('voucher_campaigns').doc(body.campaignId);
            const campSnap = await campRef.get();
            if (!campSnap.exists) return NextResponse.json({ error: 'Chiến dịch không tồn tại' }, { status: 404 });
            await campRef.update({ status: 'paused' });
            return NextResponse.json({ success: true, message: 'Đã vô hiệu hóa chiến dịch.' });
        }

        // ── Action: activate_campaign ───────────────────────────
        if (body.action === 'activate_campaign') {
            if (!body.campaignId) return NextResponse.json({ error: 'Thiếu campaignId' }, { status: 400 });
            const campRef = adminDb.collection('voucher_campaigns').doc(body.campaignId);
            const campSnap = await campRef.get();
            if (!campSnap.exists) return NextResponse.json({ error: 'Chiến dịch không tồn tại' }, { status: 404 });
            await campRef.update({ status: 'active' });
            return NextResponse.json({ success: true, message: 'Đã kích hoạt lại chiến dịch.' });
        }

        return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
