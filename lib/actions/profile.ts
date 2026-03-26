'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

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
        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();

        // ── Step 1: Sync email to Firebase Auth if provided ──────────────
        if (email) {
            try {
                const authUser = await adminAuth.getUser(uid);

                // Only update Auth email if it's currently a pseudo-email
                if (authUser.email?.endsWith('@company.com') || !authUser.email) {
                    await adminAuth.updateUser(uid, { email });
                }
            } catch (authError: unknown) {
                const msg = authError instanceof Error
                    ? authError.message
                    : 'Lỗi khi cập nhật email xác thực.';
                return { success: false, error: `Auth sync failed: ${msg}` };
            }
        }

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
