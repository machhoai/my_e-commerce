'use server';

import { getAdminDb } from '@/lib/firebase-admin';

interface MandatoryProfilePayload {
    uid: string;
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

        // NOTE: We do NOT update Firebase Auth email here.
        // The login system relies on the pseudo-email ([phone]@company.com).
        // Real email is stored in Firestore only for display/contact purposes.

        // ── Step 2: Update Firestore user document ───────────────────────
        const updateData: Record<string, unknown> = {
            ...firestoreFields,
            updatedAt: new Date().toISOString(),
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

        await adminDb.collection('users').doc(uid).update(updateData);

        return { success: true };
    } catch (error: unknown) {
        const msg = error instanceof Error
            ? error.message
            : 'Lỗi hệ thống khi cập nhật hồ sơ.';
        return { success: false, error: msg };
    }
}
