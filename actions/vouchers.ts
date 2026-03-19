'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * Voucher Redemption — Server Action
 * ═══════════════════════════════════════════════════════════════
 *
 * Uses a Firestore Transaction to atomically redeem a voucher:
 *   1. Read voucher → verify status === 'distributed'
 *   2. Check expiry date
 *   3. Update to 'used' with timestamp and staff ID
 */

import { getAdminDb } from '@/lib/firebase-admin';

export interface RedeemResult {
    success: boolean;
    error?: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED' | 'REVOKED' | 'NOT_DISTRIBUTED';
    message: string;
    voucherCode?: string;
    usedAt?: string;
}

export async function redeemVoucherAction(
    voucherCode: string,
    staffId: string,
): Promise<RedeemResult> {
    const db = getAdminDb();
    const codeRef = db.collection('voucher_codes').doc(voucherCode);

    try {
        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(codeRef);

            if (!snap.exists) {
                return {
                    success: false,
                    error: 'NOT_FOUND' as const,
                    message: 'Mã voucher không tồn tại.',
                };
            }

            const data = snap.data()!;

            // Check status
            if (data.status === 'used') {
                return {
                    success: false,
                    error: 'ALREADY_USED' as const,
                    message: `Voucher đã được sử dụng lúc ${data.usedAt || 'không rõ'}.`,
                };
            }

            if (data.status === 'revoked') {
                return {
                    success: false,
                    error: 'REVOKED' as const,
                    message: 'Voucher đã bị thu hồi.',
                };
            }

            if (data.status !== 'distributed') {
                return {
                    success: false,
                    error: 'NOT_DISTRIBUTED' as const,
                    message: `Voucher chưa được phát (trạng thái: ${data.status}).`,
                };
            }

            // Check expiry
            const today = new Date().toISOString().slice(0, 10);
            if (data.validTo && data.validTo < today) {
                return {
                    success: false,
                    error: 'EXPIRED' as const,
                    message: `Voucher đã hết hạn (${data.validTo}).`,
                };
            }

            // Redeem
            const usedAt = new Date().toISOString();
            tx.update(codeRef, {
                status: 'used',
                usedAt,
                usedByStaffId: staffId,
            });

            return {
                success: true,
                message: 'Sử dụng thành công!',
                voucherCode,
                usedAt,
            };
        });

        return result;
    } catch (err) {
        return {
            success: false,
            error: 'NOT_FOUND',
            message: err instanceof Error ? err.message : 'Lỗi không xác định.',
        };
    }
}
