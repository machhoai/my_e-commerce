import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { EventDoc, VoucherCode, VoucherCampaign, PrizePoolEntry } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

// ── POST /api/events/play ───────────────────────────────────────
// Gacha play endpoint — weighted random selection from prizePool
// Body: { eventId, playerName, playerPhone }
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            eventId: string;
            playerName: string;
            playerPhone: string;
        };

        if (!body.eventId) return NextResponse.json({ error: 'Thiếu eventId' }, { status: 400 });
        if (!body.playerName?.trim() || !body.playerPhone?.trim()) {
            return NextResponse.json({ error: 'Vui lòng nhập tên và số điện thoại' }, { status: 400 });
        }

        const adminDb = getAdminDb();
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

        // ─── Run inside a Firestore transaction ─────────────────
        const result = await adminDb.runTransaction(async (tx) => {
            // 1. Read event document
            const eventRef = adminDb.collection('events').doc(body.eventId);
            const eventSnap = await tx.get(eventRef);

            if (!eventSnap.exists) {
                return { won: false, reason: 'EVENT_NOT_FOUND' };
            }

            const event = eventSnap.data() as EventDoc;

            // 2. Verify event is active + within date bounds
            if (event.status !== 'active') {
                return { won: false, reason: 'EVENT_NOT_ACTIVE' };
            }
            if (todayStr < event.startDate || todayStr > event.endDate) {
                return { won: false, reason: 'EVENT_OUT_OF_DATE_RANGE' };
            }

            // 3. Weighted random roll from prizePool
            const prizePool = event.prizePool || [];
            if (prizePool.length === 0) {
                return { won: false, reason: 'NO_PRIZE_POOL' };
            }

            const roll = Math.random() * 100; // 0-100
            let cumulative = 0;
            let winningEntry: PrizePoolEntry | null = null;

            for (const entry of prizePool) {
                cumulative += entry.rate;
                if (roll < cumulative) {
                    winningEntry = entry;
                    break;
                }
            }

            // If roll ≥ sum of rates → LUCK_NEXT_TIME (the remaining %)
            if (!winningEntry) {
                return { won: false, reason: 'LUCK_NEXT_TIME' };
            }

            // 4. Check daily limit for the winning campaign
            const todayStats = event.dailyStats?.[todayStr] || {};
            const usedToday = todayStats[winningEntry.campaignId] || 0;

            if (usedToday >= winningEntry.dailyLimit) {
                // Daily limit hit for this campaign → fallback
                return { won: false, reason: 'DAILY_LIMIT_REACHED' };
            }

            // 5. Fetch the campaign for display info
            const campaignRef = adminDb.collection('voucher_campaigns').doc(winningEntry.campaignId);
            const campaignSnap = await tx.get(campaignRef);
            if (!campaignSnap.exists) {
                return { won: false, reason: 'CAMPAIGN_NOT_FOUND' };
            }
            const campaign = campaignSnap.data() as VoucherCampaign;

            // 6. Query an available voucher code for this campaign
            const codeQuery = adminDb.collection('voucher_codes')
                .where('campaignId', '==', winningEntry.campaignId)
                .where('status', '==', 'available')
                .limit(1);

            const codeSnap = await tx.get(codeQuery);

            if (codeSnap.empty) {
                // No codes left → fallback
                return { won: false, reason: 'NO_CODES_AVAILABLE' };
            }

            const codeDoc = codeSnap.docs[0];
            const codeData = codeDoc.data() as VoucherCode;
            const codeRef = adminDb.collection('voucher_codes').doc(codeDoc.id);

            // 7. Atomically:
            //    a. Mark voucher code as 'distributed'
            //    b. Increment dailyStats[today][campaignId]
            //    c. Write audit log

            tx.update(codeRef, {
                status: 'distributed',
                distributedToPhone: body.playerPhone.trim(),
                distributedAt: now.toISOString(),
            });

            // Increment daily stats keyed by campaignId
            const statsPath = `dailyStats.${todayStr}.${winningEntry.campaignId}`;
            tx.update(eventRef, {
                [statsPath]: FieldValue.increment(1),
            });

            // Write audit log
            const auditRef = adminDb.collection('audit_logs').doc();
            tx.set(auditRef, {
                id: auditRef.id,
                action: 'ISSUE_VOUCHER',
                actor: body.playerPhone.trim(),
                actorName: body.playerName.trim(),
                timestamp: now.toISOString(),
                targetId: event.id,
                details: `Phát voucher ${codeDoc.id} (${campaign.name}) cho ${body.playerName} (${body.playerPhone})`,
            });

            return {
                won: true,
                prize: {
                    name: campaign.name,
                    code: codeDoc.id,
                    rewardType: codeData.rewardType,
                    rewardValue: codeData.rewardValue,
                },
            };
        });

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error('Gacha play error:', err);
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message, won: false }, { status: 500 });
    }
}
