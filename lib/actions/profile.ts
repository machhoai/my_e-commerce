'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { UserDoc } from '@/types';

interface MandatoryProfilePayload {
    uid: string;
    name?: string;
    email?: string;
    avatar?: string;
    idCard?: string;
    dob?: string;
    gender?: string;
    permanentAddress?: string;
    idCardFrontPhoto?: string;
    idCardBackPhoto?: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
}

export async function submitMandatoryProfile(
    payload: MandatoryProfilePayload
): Promise<ActionResult> {
    const { uid, email, ...firestoreFields } = payload;

    if (!uid) {
        return { success: false, error: 'Thiếu UID người dùng.' };
    }

    try {
        const adminDb = getAdminDb();
        const userRef = adminDb.collection('users').doc(uid);

        // NOTE: We do NOT update Firebase Auth email here.
        // The login system relies on the pseudo-email ([phone]@company.com).
        // Real email is stored in Firestore only for display/contact purposes.

        // ── Step 2: Update Firestore user document ───────────────────────
        const now = new Date().toISOString();
        const updateData: Record<string, unknown> = {
            ...firestoreFields,
            updatedAt: now,
        };

        // Include email in Firestore update as well
        if (email) {
            updateData.email = email;
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
            const hasValidEmail = Boolean(
                merged.email
                && merged.email.includes('@')
                && !merged.email.endsWith('@company.com')
            );
            const isAdmin = merged.role === 'admin' || merged.role === 'super_admin';
            const setupIsComplete = hasValidEmail && (isAdmin || Boolean(
                merged.avatar
                && merged.idCard
                && merged.dob
                && merged.gender
                && merged.permanentAddress
                && merged.idCardFrontPhoto
                && merged.idCardBackPhoto
            ));

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
