import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { EventDoc, VoucherCampaign, VoucherCode, AuditLogDoc, EventParticipation, PrizePoolEntry } from '@/types';
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
// + participations grouped by eventId + recent plays
export async function GET(req: NextRequest) {
    try {
        const caller = await verifyAdmin(req);
        if (!caller) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const adminDb = getAdminDb();

        const [eventSnap, campaignSnap, codeSnap, auditSnap, participationSnap] = await Promise.all([
            adminDb.collection('events').orderBy('createdAt', 'desc').get(),
            adminDb.collection('voucher_campaigns').get(),
            adminDb.collection('voucher_codes').get(),
            adminDb.collection('audit_logs').orderBy('timestamp', 'desc').limit(200).get(),
            adminDb.collection('event_participations').get(),
        ]);

        const campaigns = campaignSnap.docs.map(d => ({ id: d.id, ...d.data() } as VoucherCampaign));
        const codes = codeSnap.docs.map(d => ({ id: d.id, ...d.data() } as VoucherCode));

        // Group participations by eventId
        const participationsByEvent: Record<string, EventParticipation[]> = {};
        participationSnap.docs.forEach(d => {
            const p = d.data() as EventParticipation;
            if (!participationsByEvent[p.eventId]) participationsByEvent[p.eventId] = [];
            participationsByEvent[p.eventId].push(p);
        });

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

        // All campaigns (UI will mark paused ones as non-selectable)
        const allCampaigns = campaigns;

        const auditLogs = auditSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogDoc));

        // Recent plays: last 20 ISSUE_VOUCHER entries
        const recentPlays = auditLogs.filter(l => l.action === 'ISSUE_VOUCHER').slice(0, 20);

        return NextResponse.json({
            events,
            campaigns: allCampaigns,
            auditLogs,
            participations: participationsByEvent,
            recentPlays,
        });
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
// Full event editing: status, name, dates, prizePool
export async function PATCH(req: NextRequest) {
    try {
        const caller = await verifyAdmin(req);
        if (!caller) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as {
            eventId: string;
            status?: EventDoc['status'];
            name?: string;
            startDate?: string;
            endDate?: string;
            prizePool?: PrizePoolEntry[];
        };

        if (!body.eventId) return NextResponse.json({ error: 'Thiếu eventId' }, { status: 400 });

        const adminDb = getAdminDb();
        const eventRef = adminDb.collection('events').doc(body.eventId);
        const eventSnap = await eventRef.get();
        if (!eventSnap.exists) {
            return NextResponse.json({ error: 'Sự kiện không tồn tại' }, { status: 404 });
        }

        const existingEvent = eventSnap.data() as EventDoc;
        const updateData: Record<string, unknown> = {};
        const changes: string[] = [];

        if (body.name !== undefined && body.name.trim()) {
            updateData.name = body.name.trim();
            changes.push(`đổi tên thành "${body.name.trim()}"`);
        }
        if (body.status !== undefined) {
            updateData.status = body.status;
            changes.push(`trạng thái → "${body.status}"`);
        }
        if (body.startDate !== undefined) {
            updateData.startDate = body.startDate;
            changes.push(`bắt đầu → ${body.startDate}`);
        }
        if (body.endDate !== undefined) {
            updateData.endDate = body.endDate;
            changes.push(`kết thúc → ${body.endDate}`);
        }

        // Validate & update prizePool
        if (body.prizePool !== undefined) {
            if (!body.prizePool.length) {
                return NextResponse.json({ error: 'Cần ít nhất 1 chiến dịch trong pool' }, { status: 400 });
            }
            const totalRate = body.prizePool.reduce((sum, p) => sum + (p.rate || 0), 0);
            if (totalRate > 100) {
                return NextResponse.json({ error: `Tổng tỉ lệ trúng (${totalRate}%) vượt quá 100%` }, { status: 400 });
            }

            const sd = body.startDate || existingEvent.startDate;
            const ed = body.endDate || existingEvent.endDate;
            const totalDays = Math.ceil((new Date(ed).getTime() - new Date(sd).getTime()) / (1000 * 60 * 60 * 24)) + 1;

            for (const entry of body.prizePool) {
                const campSnap = await adminDb.collection('voucher_campaigns').doc(entry.campaignId).get();
                if (!campSnap.exists) {
                    return NextResponse.json({ error: `Chiến dịch ${entry.campaignId} không tồn tại` }, { status: 404 });
                }
                const camp = campSnap.data() as VoucherCampaign;
                const maxIssuance = (entry.dailyLimit || 0) * totalDays;
                if (maxIssuance > camp.totalIssued) {
                    return NextResponse.json({
                        error: `Chiến dịch "${camp.name}": ${entry.dailyLimit}/ngày × ${totalDays} ngày = ${maxIssuance} > tổng mã ${camp.totalIssued}`,
                    }, { status: 400 });
                }
                entry.campaignName = camp.name;
                entry.rewardType = camp.rewardType;
            }

            updateData.prizePool = body.prizePool;
            changes.push(`cập nhật ${body.prizePool.length} chiến dịch trong pool`);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const batch = adminDb.batch();
        batch.update(eventRef, updateData);

        const auditRef = adminDb.collection('audit_logs').doc();
        batch.set(auditRef, {
            id: auditRef.id,
            action: 'UPDATE_EVENT',
            actor: caller.uid,
            actorName: caller.name,
            timestamp: now,
            targetId: body.eventId,
            details: `Chỉnh sửa sự kiện: ${changes.join(', ')}`,
        });

        await batch.commit();

        return NextResponse.json({ success: true, message: 'Cập nhật sự kiện thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
