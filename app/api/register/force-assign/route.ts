import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { WeeklyRegistration, ShiftEntry } from '@/types';

// POST /api/register/force-assign — Manager adds an employee to the registration pool
export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        // 2. Check caller is admin/store_manager/manager with HR permission
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        }
        const callerData = callerDoc.data()!;
        const allowedRoles = ['admin', 'store_manager', 'manager'];
        if (!allowedRoles.includes(callerData.role) && !callerData.canManageHR) {
            return NextResponse.json({ error: 'Không có quyền gán ca' }, { status: 403 });
        }

        // 3. Parse request body
        const body = await req.json() as {
            targetUserId: string;
            storeId: string;
            weekStartDate: string;
            date: string;
            shiftId: string;
        };

        if (!body.targetUserId || !body.storeId || !body.weekStartDate || !body.date || !body.shiftId) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        // 4. Verify target user exists and belongs to the same store
        const targetUserDoc = await adminDb.collection('users').doc(body.targetUserId).get();
        if (!targetUserDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy nhân viên' }, { status: 404 });
        }
        const targetUser = targetUserDoc.data()!;
        if (targetUser.storeId !== body.storeId) {
            return NextResponse.json({ error: 'Nhân viên không thuộc cửa hàng này' }, { status: 400 });
        }

        // 5. Create or update the weekly_registration for this user
        const regId = `${body.targetUserId}_${body.weekStartDate}`;
        const regRef = adminDb.collection('weekly_registrations').doc(regId);
        const existingReg = await regRef.get();

        const newShift: ShiftEntry = { date: body.date, shiftId: body.shiftId };

        if (existingReg.exists) {
            const regData = existingReg.data() as WeeklyRegistration;
            // Check if this shift already exists
            const alreadyRegistered = regData.shifts.some(
                s => s.date === body.date && s.shiftId === body.shiftId
            );
            if (alreadyRegistered) {
                return NextResponse.json({ error: 'Nhân viên đã đăng ký ca này' }, { status: 409 });
            }

            // Append the new shift
            await regRef.update({
                shifts: [...regData.shifts, newShift],
                isAssignedByManager: true, // Mark the entire registration as manager-assigned
            });
        } else {
            // Create new registration
            const newReg: WeeklyRegistration & { isAssignedByManager: boolean } = {
                id: regId,
                userId: body.targetUserId,
                storeId: body.storeId,
                weekStartDate: body.weekStartDate,
                shifts: [newShift],
                submittedAt: new Date().toISOString(),
                isAssignedByManager: true,
            };
            await regRef.set(newReg);
        }


        return NextResponse.json({ message: 'Đã thêm nhân viên vào danh sách làm việc' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        console.error('[ForceAssign POST] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/register/force-assign — Manager removes a force-assigned registration
export async function DELETE(req: NextRequest) {
    try {
        // 1. Authenticate
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        // 2. Check caller permissions
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        }
        const callerData = callerDoc.data()!;
        const allowedRoles = ['admin', 'store_manager', 'manager'];
        if (!allowedRoles.includes(callerData.role) && !callerData.canManageHR) {
            return NextResponse.json({ error: 'Không có quyền hủy gán ca' }, { status: 403 });
        }

        // 3. Parse request body
        const body = await req.json() as {
            targetUserId: string;
            weekStartDate: string;
            date: string;
            shiftId: string;
        };

        if (!body.targetUserId || !body.weekStartDate || !body.date || !body.shiftId) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        // 4. Find and update the registration
        const regId = `${body.targetUserId}_${body.weekStartDate}`;
        const regRef = adminDb.collection('weekly_registrations').doc(regId);
        const existingReg = await regRef.get();

        if (!existingReg.exists) {
            return NextResponse.json({ error: 'Không tìm thấy đăng ký' }, { status: 404 });
        }

        const regData = existingReg.data() as WeeklyRegistration;

        // Remove the specific shift
        const updatedShifts = regData.shifts.filter(
            s => !(s.date === body.date && s.shiftId === body.shiftId)
        );

        if (updatedShifts.length === 0) {
            // No shifts left — delete the entire document
            await regRef.delete();
        } else {
            await regRef.update({ shifts: updatedShifts });
        }

        return NextResponse.json({ message: 'Đã hủy gán ca thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        console.error('[ForceAssign DELETE] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
