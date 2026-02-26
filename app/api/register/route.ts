import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { WeeklyRegistration } from '@/types';

// POST /api/register — Submit weekly shift registration with server-side validation
export async function POST(req: NextRequest) {
    try {
        // 1. Verify the caller is authenticated
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();

        // 2. Get the caller's user doc to find their storeId
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        }
        const callerData = callerDoc.data()!;
        const storeId: string = callerData.storeId ?? '';

        if (!storeId) {
            return NextResponse.json({ error: 'Tài khoản chưa được gán vào cửa hàng' }, { status: 400 });
        }

        // 3. *** SERVER-SIDE SECURITY CHECK ***
        // Fetch the LATEST store settings — cannot be spoofed by client
        const storeSnap = await adminDb.collection('stores').doc(storeId).get();
        const storeData = storeSnap.data();
        const registrationOpen: boolean = storeData?.settings?.registrationOpen ?? false;

        if (!registrationOpen) {
            return NextResponse.json(
                { error: 'Đăng ký thất bại do cổng đăng ký đã đóng' },
                { status: 403 }
            );
        }

        // 4. Parse and validate the request body
        const body = await req.json() as WeeklyRegistration;

        if (!body.id || !body.userId || !body.storeId || !body.weekStartDate) {
            return NextResponse.json({ error: 'Dữ liệu đăng ký không hợp lệ' }, { status: 400 });
        }

        // 5. Ensure the user can only submit for themselves
        if (body.userId !== decoded.uid) {
            return NextResponse.json({ error: 'Không được phép thay đổi đăng ký của người khác' }, { status: 403 });
        }

        // 6. Ensure the storeId in the payload matches the user's actual store
        if (body.storeId !== storeId) {
            return NextResponse.json({ error: 'Cửa hàng không khớp' }, { status: 400 });
        }

        // 7. Save to Firestore
        await adminDb.collection('weekly_registrations').doc(body.id).set({
            ...body,
            submittedAt: new Date().toISOString(),
        });

        return NextResponse.json({ message: 'Đăng ký ca làm thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/register — Delete a weekly shift registration with server-side validation  
export async function DELETE(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();

        // Get caller's storeId
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        }
        const callerData = callerDoc.data()!;
        const storeId: string = callerData.storeId ?? '';

        // Server-side check: registration must be open to allow deletion too
        if (storeId) {
            const storeSnap = await adminDb.collection('stores').doc(storeId).get();
            const registrationOpen: boolean = storeSnap.data()?.settings?.registrationOpen ?? false;
            if (!registrationOpen) {
                return NextResponse.json(
                    { error: 'Đăng ký thất bại do cổng đăng ký đã đóng' },
                    { status: 403 }
                );
            }
        }

        const { registrationId } = await req.json() as { registrationId: string };
        if (!registrationId) {
            return NextResponse.json({ error: 'Thiếu registrationId' }, { status: 400 });
        }

        // Verify this registration belongs to the caller
        const regSnap = await adminDb.collection('weekly_registrations').doc(registrationId).get();
        if (!regSnap.exists) {
            return NextResponse.json({ error: 'Không tìm thấy đăng ký' }, { status: 404 });
        }
        if (regSnap.data()?.userId !== decoded.uid) {
            return NextResponse.json({ error: 'Không được phép xóa đăng ký của người khác' }, { status: 403 });
        }

        await adminDb.collection('weekly_registrations').doc(registrationId).delete();
        return NextResponse.json({ message: 'Đã xóa đăng ký thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
