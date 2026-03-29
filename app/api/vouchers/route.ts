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

// ── Parallel batch execution helper ──────────────────────────────
// Executes Firestore batch commits up to `maxConcurrent` at a time
async function runParallelBatches(
    db: FirebaseFirestore.Firestore,
    operations: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown>; type: 'set' | 'update' }>,
    maxConcurrent = 15,
) {
    const BATCH_LIMIT = 500;
    const batches: FirebaseFirestore.WriteBatch[] = [];
    for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
        const chunk = operations.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const op of chunk) {
            if (op.type === 'set') batch.set(op.ref, op.data);
            else batch.update(op.ref, op.data);
        }
        batches.push(batch);
    }
    // Throttle: execute maxConcurrent batches at a time
    for (let i = 0; i < batches.length; i += maxConcurrent) {
        await Promise.all(batches.slice(i, i + maxConcurrent).map(b => b.commit()));
    }
    return operations.length;
}

// ── PATCH /api/vouchers ─────────────────────────────────────────
// Actions: revoke | add_codes | update_expiry | deactivate_campaign | activate_campaign
// All bulk operations use parallel batching (15 concurrent Firestore batch commits)
export async function PATCH(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as {
            action: 'revoke' | 'add_codes' | 'update_expiry' | 'deactivate_campaign' | 'activate_campaign' | 'update_campaign';
            codeId?: string;
            codeIds?: string[];
            campaignId?: string;
            quantity?: number;
            validTo?: string;
            // update_campaign fields
            name?: string;
            description?: string;
            rewardType?: VoucherRewardType;
            rewardValue?: number;
            validFrom?: string;
            purpose?: 'print' | 'event';
            imageUrl?: string;
            // Chunking params
            limit?: number;
            lastDocId?: string;
        };

        const adminDb = getAdminDb();

        // ── Action: update_campaign ─────────────────────────────
        if (body.action === 'update_campaign') {
            if (!body.campaignId) return NextResponse.json({ error: 'Thiếu campaignId' }, { status: 400 });
            const campRef = adminDb.collection('voucher_campaigns').doc(body.campaignId);
            const campSnap = await campRef.get();
            if (!campSnap.exists) return NextResponse.json({ error: 'Chiến dịch không tồn tại' }, { status: 404 });

            // Build partial update — only include provided fields
            const update: Record<string, unknown> = {};
            if (body.name?.trim()) update.name = body.name.trim();
            if (body.description !== undefined) update.description = body.description.trim();
            if (body.rewardType) update.rewardType = body.rewardType;
            if (body.rewardValue !== undefined) update.rewardValue = body.rewardValue;
            if (body.validFrom) update.validFrom = body.validFrom;
            if (body.validTo) update.validTo = body.validTo;
            if (body.purpose) update.purpose = body.purpose;
            if (body.imageUrl !== undefined) update.image = body.imageUrl || null;

            if (Object.keys(update).length === 0) {
                return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 });
            }

            await campRef.update(update);
            return NextResponse.json({ success: true, message: 'Đã cập nhật thông tin chiến dịch.' });
        }


        // ── Action: revoke (up to 5000 IDs per call) ────────────
        if (body.action === 'revoke') {
            const ids: string[] = body.codeIds?.length ? body.codeIds : body.codeId ? [body.codeId] : [];
            if (ids.length === 0) return NextResponse.json({ error: 'Thiếu mã voucher' }, { status: 400 });
            if (ids.length > 5000) return NextResponse.json({ error: 'Tối đa 5000 mã mỗi lần' }, { status: 400 });

            // Batch-read docs in chunks of 30 (Firestore 'in' limit)
            const docMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
            for (let i = 0; i < ids.length; i += 30) {
                const chunk = ids.slice(i, i + 30);
                const snap = await adminDb.collection('voucher_codes')
                    .where('__name__', 'in', chunk).get();
                snap.docs.forEach(d => docMap.set(d.id, d));
            }

            const skipped: string[] = [];
            const ops: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown>; type: 'set' | 'update' }> = [];
            for (const id of ids) {
                const doc = docMap.get(id);
                if (!doc || !doc.exists) { skipped.push(id); continue; }
                const status = (doc.data() as VoucherCode).status;
                if (status === 'used' || status === 'revoked') { skipped.push(id); continue; }
                ops.push({ ref: doc.ref, data: { status: 'revoked' }, type: 'update' });
            }
            if (ops.length > 0) await runParallelBatches(adminDb, ops);

            return NextResponse.json({
                success: true,
                revoked: ops.length,
                skipped: skipped.length,
                message: `Đã vô hiệu hóa ${ops.length} mã${skipped.length > 0 ? `, bỏ qua ${skipped.length} mã` : ''}.`,
            });
        }

        // ── Action: add_codes (chunked by quantity) ─────────────
        if (body.action === 'add_codes') {
            if (!body.campaignId) return NextResponse.json({ error: 'Thiếu campaignId' }, { status: 400 });
            const qty = body.quantity || 0;
            if (qty < 1 || qty > 50000) return NextResponse.json({ error: 'Số lượng phải từ 1 đến 50.000 mỗi batch' }, { status: 400 });

            const campRef = adminDb.collection('voucher_campaigns').doc(body.campaignId);
            const campSnap = await campRef.get();
            if (!campSnap.exists) return NextResponse.json({ error: 'Chiến dịch không tồn tại' }, { status: 404 });

            const camp = campSnap.data() as VoucherCampaign;
            const generatedCodes = new Set<string>();
            const codeDocuments: VoucherCode[] = [];

            // Generate codes
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

            // Parallel batch write
            const ops = codeDocuments.map(doc => ({
                ref: adminDb.collection('voucher_codes').doc(doc.id),
                data: doc as unknown as Record<string, unknown>,
                type: 'set' as const,
            }));
            await runParallelBatches(adminDb, ops);

            // Atomically increment totalIssued
            const { FieldValue } = await import('firebase-admin/firestore');
            await campRef.update({ totalIssued: FieldValue.increment(codeDocuments.length) });

            return NextResponse.json({
                success: true,
                generatedCount: codeDocuments.length,
                campaignId: body.campaignId,
                message: `Đã tạo thêm ${codeDocuments.length} mã cho chiến dịch "${camp.name}".`,
            });
        }

        // ── Action: update_expiry (cursor-based chunking) ───────
        if (body.action === 'update_expiry') {
            if (!body.campaignId) return NextResponse.json({ error: 'Thiếu campaignId' }, { status: 400 });
            if (!body.validTo) return NextResponse.json({ error: 'Thiếu ngày hết hạn mới' }, { status: 400 });

            const limit = Math.min(Math.max(body.limit || 5000, 100), 10000);

            // Update campaign validTo only on first chunk (no cursor)
            if (!body.lastDocId) {
                const campRef = adminDb.collection('voucher_campaigns').doc(body.campaignId);
                const campSnap = await campRef.get();
                if (!campSnap.exists) return NextResponse.json({ error: 'Chiến dịch không tồn tại' }, { status: 404 });
                await campRef.update({ validTo: body.validTo });
            }

            // Build cursor-paginated query
            let q: FirebaseFirestore.Query = adminDb.collection('voucher_codes')
                .where('campaignId', '==', body.campaignId)
                .where('status', 'in', ['available', 'distributed'])
                .orderBy('__name__')
                .limit(limit);

            if (body.lastDocId) {
                const cursorRef = adminDb.collection('voucher_codes').doc(body.lastDocId);
                const cursorSnap = await cursorRef.get();
                if (cursorSnap.exists) {
                    q = q.startAfter(cursorSnap);
                }
            }

            const snapshot = await q.get();
            if (snapshot.empty) {
                return NextResponse.json({
                    success: true,
                    updatedCount: 0,
                    nextCursor: null,
                    isComplete: true,
                    message: 'Không còn mã nào cần cập nhật.',
                });
            }

            // Parallel batch update
            const ops = snapshot.docs.map(doc => ({
                ref: doc.ref,
                data: { validTo: body.validTo } as Record<string, unknown>,
                type: 'update' as const,
            }));
            await runParallelBatches(adminDb, ops);

            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            const isComplete = snapshot.docs.length < limit;

            return NextResponse.json({
                success: true,
                updatedCount: snapshot.docs.length,
                nextCursor: isComplete ? null : lastDoc.id,
                isComplete,
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
