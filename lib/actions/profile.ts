'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { UserDoc } from '@/types';
import { isProfileComplete } from '@/lib/profile-completion';

interface MandatoryProfilePayload {
    name?: string;
    email?: string;
    avatar?: string;
    idCard?: string;
    dob?: string;
    gender?: string;
    permanentAddress?: string;
    idCardFrontPhoto?: string;
    idCardBackPhoto?: string;
    bankAccount?: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
}

export async function submitMandatoryProfile(
    idToken: string,
    payload: MandatoryProfilePayload
): Promise<ActionResult> {
    const identity = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
    if (!identity) return { success: false, error: 'Phiên đăng nhập không hợp lệ.' };
    const { uid } = identity;

    try {
        const adminDb = getAdminDb();
        const userRef = adminDb.collection('users').doc(uid);

        // NOTE: We do NOT update Firebase Auth email here.
        // The login system relies on the pseudo-email ([phone]@company.com).
        // Real email is stored in Firestore only for display/contact purposes.

        // ── Step 2: Update Firestore user document ───────────────────────
        const now = new Date().toISOString();
        const updateData: Record<string, unknown> = {
            name: payload.name,
            avatar: payload.avatar,
            idCard: payload.idCard,
            dob: payload.dob,
            gender: payload.gender,
            permanentAddress: payload.permanentAddress,
            idCardFrontPhoto: payload.idCardFrontPhoto,
            idCardBackPhoto: payload.idCardBackPhoto,
            bankAccount: payload.bankAccount,
            updatedAt: now,
        };

        // Include email in Firestore update as well
        if (payload.email) {
            updateData.email = payload.email;
        }

        // Remove undefined keys so we don't accidentally null out existing fields
        for (const key of Object.keys(updateData)) {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        }

        await adminDb.runTransaction(async transaction => {
            const snapshot = await transaction.get(userRef);
            if (!snapshot.exists) throw new Error('Không tìm thấy người dùng.');

            const current = { uid, ...snapshot.data() } as UserDoc;
            const merged = { ...current, ...updateData } as UserDoc;
            const isAdmin = merged.role === 'admin' || merged.role === 'super_admin';
            if (!isAdmin) {
                if (typeof merged.bankAccount !== 'string' || !/^\d+$/.test(merged.bankAccount.trim())) {
                    throw new Error('Vui lòng nhập số tài khoản ngân hàng Techcombank hợp lệ.');
                }
                updateData.bankAccount = merged.bankAccount.trim();
            }
            const setupIsComplete = isProfileComplete(merged);

            if (setupIsComplete && !current.setupCompletedAt) {
                updateData.setupCompletedAt = now;
            }
            transaction.update(userRef, updateData);
        });

        return { success: true };
    } catch (error: unknown) {
        const msg = error instanceof Error
            ? error.message
            : 'Lỗi hệ thống khi cập nhật hồ sơ.';
        return { success: false, error: msg };
    }
}
