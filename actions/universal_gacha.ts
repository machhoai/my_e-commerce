'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * Universal Gacha Engine — Headless Promotion Engine
 * ═══════════════════════════════════════════════════════════════
 *
 * The central brain of the promotion system. Any bespoke event
 * frontend calls this Server Action with an eventId and customer
 * data. The engine handles:
 *
 *   1. Event validation (status, date bounds)
 *   2. Spin deduction (event_participations)
 *   3. Weighted random prize selection (prizePool rates)
 *   4. Daily limit enforcement per campaign
 *   5. Atomic voucher distribution (Firestore transaction)
 *   6. Audit trail logging
 *
 * Returns a standardized GachaResult every time.
 */

import { getAdminDb } from '@/lib/firebase-admin';
import { DEFAULT_SPINS } from '@/lib/event-engine';
import { FieldValue } from 'firebase-admin/firestore';
import type {
    EventDoc,
    EventParticipation,
    PrizePoolEntry,
    VoucherCampaign,
    VoucherCode,
    GachaResult,
} from '@/types';

// ─── executeGacha ───────────────────────────────────────────────
/**
 * Execute a single gacha spin for a player.
 *
 * @param eventId  - The Firestore event document ID
 * @param customerData - Player info: { phone, name }
 * @returns GachaResult with standardized status
 */
export async function executeGacha(
    eventId: string,
    customerData: { phone: string; name: string },
): Promise<GachaResult> {
    // ── Input validation ────────────────────────────────────────
    if (!eventId) {
        return {
            success: false,
            status: 'ERROR',
            message: 'eventId is required',
        };
    }

    const phone = customerData.phone?.trim();
    const name = customerData.name?.trim();

    if (!phone || !name) {
        return {
            success: false,
            status: 'ERROR',
            message: 'Phone and name are required',
        };
    }

    const db = getAdminDb();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    try {
        // ── Run entire logic inside a Firestore transaction ─────
        const result = await db.runTransaction(async (tx) => {
            // ─── 1. Read event ──────────────────────────────────
            const eventRef = db.collection('events').doc(eventId);
            const eventSnap = await tx.get(eventRef);

            if (!eventSnap.exists) {
                return {
                    success: false,
                    status: 'ERROR' as const,
                    message: 'Event not found',
                };
            }

            const event = eventSnap.data() as EventDoc;

            // ─── 2. Validate event is active + in date range ───
            if (event.status !== 'active') {
                return {
                    success: false,
                    status: 'ERROR' as const,
                    message: 'Event is not active',
                };
            }

            if (todayStr < event.startDate || todayStr > event.endDate) {
                return {
                    success: false,
                    status: 'ERROR' as const,
                    message: 'Event is outside its date range',
                };
            }

            // ─── 3. Check/create participation (spin tracking) ─
            const participationId = `${eventId}_${phone.replace(/\s+/g, '')}`;
            const partRef = db.collection('event_participations').doc(participationId);
            const partSnap = await tx.get(partRef);

            let participation: EventParticipation;

            if (partSnap.exists) {
                participation = partSnap.data() as EventParticipation;
            } else {
                // First-time player — create record
                participation = {
                    eventId,
                    phone,
                    name,
                    totalSpins: DEFAULT_SPINS,
                    usedSpins: 0,
                    prizes: [],
                    createdAt: now.toISOString(),
                };
            }

            // Check if spins remain
            if (participation.usedSpins >= participation.totalSpins) {
                return {
                    success: true,
                    status: 'NO_SPINS_LEFT' as const,
                    spinsRemaining: 0,
                    message: 'No spins remaining',
                };
            }

            // ─── 4. Weighted random roll ────────────────────────
            const prizePool = event.prizePool || [];
            if (prizePool.length === 0) {
                return {
                    success: false,
                    status: 'ERROR' as const,
                    message: 'No prizes configured',
                };
            }

            const roll = Math.random() * 100;
            let cumulative = 0;
            let winningEntry: PrizePoolEntry | null = null;

            for (const entry of prizePool) {
                cumulative += entry.rate;
                if (roll < cumulative) {
                    winningEntry = entry;
                    break;
                }
            }

            // Increment used spins (happens regardless of win/loss)
            const newUsedSpins = participation.usedSpins + 1;
            const spinsRemaining = Math.max(0, participation.totalSpins - newUsedSpins);

            // ─── 5a. No win (fell in remaining %) ──────────────
            if (!winningEntry) {
                // Update participation
                if (partSnap.exists) {
                    tx.update(partRef, { usedSpins: FieldValue.increment(1) });
                } else {
                    tx.set(partRef, { ...participation, usedSpins: 1 });
                }

                return {
                    success: true,
                    status: 'LUCK_NEXT_TIME' as const,
                    spinsRemaining,
                    message: 'Better luck next time!',
                };
            }

            // ─── 5b. Won — check daily limit ───────────────────
            const todayStats = event.dailyStats?.[todayStr] || {};
            const usedToday = todayStats[winningEntry.campaignId] || 0;

            if (usedToday >= winningEntry.dailyLimit) {
                // Daily limit reached → fallback to LUCK_NEXT_TIME
                if (partSnap.exists) {
                    tx.update(partRef, { usedSpins: FieldValue.increment(1) });
                } else {
                    tx.set(partRef, { ...participation, usedSpins: 1 });
                }

                return {
                    success: true,
                    status: 'LUCK_NEXT_TIME' as const,
                    spinsRemaining,
                    message: 'Daily limit reached for this prize',
                };
            }

            // ─── 5c. Fetch campaign info ────────────────────────
            const campaignRef = db.collection('voucher_campaigns').doc(winningEntry.campaignId);
            const campaignSnap = await tx.get(campaignRef);

            if (!campaignSnap.exists) {
                if (partSnap.exists) {
                    tx.update(partRef, { usedSpins: FieldValue.increment(1) });
                } else {
                    tx.set(partRef, { ...participation, usedSpins: 1 });
                }

                return {
                    success: true,
                    status: 'LUCK_NEXT_TIME' as const,
                    spinsRemaining,
                    message: 'Prize configuration issue',
                };
            }

            const campaign = campaignSnap.data() as VoucherCampaign;

            // ─── 5d. Find an available voucher code ─────────────
            const codeQuery = db.collection('voucher_codes')
                .where('campaignId', '==', winningEntry.campaignId)
                .where('status', '==', 'available')
                .limit(1);

            const codeSnap = await tx.get(codeQuery);

            if (codeSnap.empty) {
                // No physical codes left
                if (partSnap.exists) {
                    tx.update(partRef, { usedSpins: FieldValue.increment(1) });
                } else {
                    tx.set(partRef, { ...participation, usedSpins: 1 });
                }

                return {
                    success: true,
                    status: 'LUCK_NEXT_TIME' as const,
                    spinsRemaining,
                    message: 'Out of stock for this prize',
                };
            }

            // ─── 6. Atomic writes ──────────────────────────────
            const codeDoc = codeSnap.docs[0];
            const codeData = codeDoc.data() as VoucherCode;
            const codeRef = db.collection('voucher_codes').doc(codeDoc.id);

            // 6a. Mark voucher as distributed
            tx.update(codeRef, {
                status: 'distributed',
                distributedToPhone: phone,
                distributedAt: now.toISOString(),
            });

            // 6b. Increment event daily stats
            const statsPath = `dailyStats.${todayStr}.${winningEntry.campaignId}`;
            tx.update(eventRef, {
                [statsPath]: FieldValue.increment(1),
            });

            // 6c. Update participation (increment spin + add prize)
            if (partSnap.exists) {
                tx.update(partRef, {
                    usedSpins: FieldValue.increment(1),
                    prizes: FieldValue.arrayUnion(codeDoc.id),
                });
            } else {
                tx.set(partRef, {
                    ...participation,
                    usedSpins: 1,
                    prizes: [codeDoc.id],
                });
            }

            // 6d. Write audit log
            const auditRef = db.collection('audit_logs').doc();
            tx.set(auditRef, {
                id: auditRef.id,
                action: 'ISSUE_VOUCHER',
                actor: phone,
                actorName: name,
                timestamp: now.toISOString(),
                targetId: eventId,
                details: `[Gacha] ${name} (${phone}) won ${codeDoc.id} from "${campaign.name}"`,
            });

            // ─── 7. Return success ─────────────────────────────
            return {
                success: true,
                status: 'WON_VOUCHER' as const,
                spinsRemaining,
                prizeData: {
                    campaignId: winningEntry.campaignId,
                    campaignName: campaign.name,
                    rewardType: codeData.rewardType,
                    rewardValue: codeData.rewardValue,
                    voucherCode: codeDoc.id,
                },
                message: `You won: ${campaign.name}!`,
            };
        });

        return result;
    } catch (err: unknown) {
        console.error('[Universal Gacha] Transaction error:', err);
        return {
            success: false,
            status: 'ERROR',
            message: err instanceof Error ? err.message : 'System error',
        };
    }
}
