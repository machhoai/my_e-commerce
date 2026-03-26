import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getAdminDb } from '@/lib/firebase-admin';

const MIGRATION_SECRET = 'run-migration-2026';

interface MigrationError {
    uid: string;
    error: string;
}

interface MigrationResult {
    message: string;
    successCount: number;
    skippedCount: number;
    errorCount: number;
    errors: MigrationError[];
}

export async function GET(request: NextRequest): Promise<NextResponse<MigrationResult | { error: string }>> {
    // Security: validate secret query parameter
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (!secret || secret !== MIGRATION_SECRET) {
        return NextResponse.json(
            { error: 'Forbidden: Invalid or missing secret.' },
            { status: 403 }
        );
    }

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: MigrationError[] = [];

    try {
        const adminDb = getAdminDb();
        const adminAuth = getAdminAuth();

        // Fetch ALL user documents from Firestore
        const usersSnapshot = await adminDb.collection('users').get();

        // Process each user sequentially to avoid rate limits
        for (const doc of usersSnapshot.docs) {
            const uid = doc.id;
            const userData = doc.data();
            const firestoreEmail: string | undefined = userData?.email;

            // Condition 1: Skip if Firestore doc has no valid email
            if (!firestoreEmail || typeof firestoreEmail !== 'string' || !firestoreEmail.includes('@')) {
                skippedCount++;
                continue;
            }

            try {
                // Condition 2: Fetch the user from Firebase Auth
                const authUser = await adminAuth.getUser(uid);

                // Condition 3: Only update if Auth email ends with @company.com
                if (authUser.email && authUser.email.endsWith('@company.com')) {
                    try {
                        await adminAuth.updateUser(uid, { email: firestoreEmail });
                        successCount++;
                    } catch (updateError: unknown) {
                        const message = updateError instanceof Error
                            ? updateError.message
                            : String(updateError);
                        errors.push({ uid, error: `Failed to update: ${message}` });
                        errorCount++;
                    }
                } else {
                    // Auth email is already correct (not a pseudo-email)
                    skippedCount++;
                }
            } catch (fetchError: unknown) {
                // Auth user doesn't exist for this Firestore doc
                const message = fetchError instanceof Error
                    ? fetchError.message
                    : String(fetchError);
                errors.push({ uid, error: `Auth user not found: ${message}` });
                errorCount++;
            }
        }

        return NextResponse.json({
            message: 'Migration complete',
            successCount,
            skippedCount,
            errorCount,
            errors,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: `Migration failed: ${message}` },
            { status: 500 }
        );
    }
}
