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

        // 4b. *** SERVER-SIDE SECURITY CHECK *** Check if week is editable (must be next week or later)
        const currentWeekStartOfToday = new Date();
        const day = currentWeekStartOfToday.getDay();
        const diff = currentWeekStartOfToday.getDate() - day + (day === 0 ? -6 : 1);
        currentWeekStartOfToday.setDate(diff);
        currentWeekStartOfToday.setHours(0, 0, 0, 0);

        const minEditableWeekStart = new Date(currentWeekStartOfToday);
        minEditableWeekStart.setDate(minEditableWeekStart.getDate() + 7);

        const targetWeekStart = new Date(body.weekStartDate + 'T00:00:00');

        if (targetWeekStart.getTime() !== minEditableWeekStart.getTime()) {
            return NextResponse.json({ error: 'Chỉ được phép đăng ký và thay đổi lịch cho báo đúng tuần đang mở đăng ký (Tuần tiếp theo)' }, { status: 403 });
        }

        // 5. Ensure the user can only submit for themselves
        if (body.userId !== decoded.uid) {
            return NextResponse.json({ error: 'Không được phép thay đổi đăng ký của người khác' }, { status: 403 });
        }

        // 6. Ensure the storeId in the payload matches the user's actual store
        if (body.storeId !== storeId) {
            return NextResponse.json({ error: 'Cửa hàng không khớp' }, { status: 400 });
        }

        // 7. PRE-FETCH USERS for counting logic
        const usersSnap = await adminDb.collection('users').where('storeId', '==', storeId).get();
        const validEmployeeUids = new Set<string>();
        usersSnap.forEach(d => {
            const data = d.data();
            if (data.role !== 'manager' && data.role !== 'store_manager' && data.active !== false) {
                validEmployeeUids.add(data.uid);
            }
        });

        // 8. TRANSACTION TO PREVENT RACE CONDITIONS
        const registrationRef = adminDb.collection('weekly_registrations').doc(body.id);
        const weekRegsQuery = adminDb.collection('weekly_registrations')
            .where('weekStartDate', '==', body.weekStartDate)
            .where('storeId', '==', storeId);

        await adminDb.runTransaction(async (transaction) => {
            // Read all registrations for this week
            const allRegsSnap = await transaction.get(weekRegsQuery);
            const allRegs: WeeklyRegistration[] = [];
            allRegsSnap.forEach(d => {
                // exclude the current user's OLD registration from the count so we don't double count
                if (d.id !== body.id) {
                    allRegs.push(d.data() as WeeklyRegistration);
                }
            });

            // If the user making the request is a valid employee, add their NEW requested shifts to the tally
            const isCallerValidEmployee = validEmployeeUids.has(body.userId);

            // Calculate current counts per shift + caller's requested shifts
            const shiftCounts: Record<string, number> = {};

            // Count existing
            for (const reg of allRegs) {
                if (validEmployeeUids.has(reg.userId)) {
                    for (const shift of reg.shifts) {
                        const key = `${shift.date}_${shift.shiftId}`;
                        shiftCounts[key] = (shiftCounts[key] || 0) + 1;
                    }
                }
            }

            // Check caller's requested shifts against quotas
            if (isCallerValidEmployee) {
                const quotas = storeData?.settings?.quotas;

                for (const shift of body.shifts) {
                    const key = `${shift.date}_${shift.shiftId}`;
                    const currentCount = shiftCounts[key] || 0;

                    // Determine max quota
                    let maxCount = 5; // fallback
                    if (quotas) {
                        if (quotas.specialDates?.[shift.date]?.[shift.shiftId] !== undefined) {
                            maxCount = quotas.specialDates[shift.date][shift.shiftId];
                        } else {
                            const day = new Date(shift.date + 'T00:00:00').getDay();
                            const isWeekend = day === 0 || day === 6;
                            maxCount = isWeekend
                                ? (quotas.defaultWeekend?.[shift.shiftId] ?? 5)
                                : (quotas.defaultWeekday?.[shift.shiftId] ?? 5);
                        }
                    }

                    if (currentCount >= maxCount) {
                        throw new Error(`Ca ${shift.shiftId} ngày ${shift.date} đã đầy (${currentCount}/${maxCount}). Vui lòng chọn ca hoặc ngày khác để tránh vượt quá số lượng cho phép.`);
                    }

                    // Increment conceptually for the rest of the loop (though body only has 1 instance of each shift usually)
                    shiftCounts[key] = currentCount + 1;
                }
            }

            // If all checks passed, write the document
            transaction.set(registrationRef, {
                ...body,
                submittedAt: new Date().toISOString(),
            });
        });

        return NextResponse.json({ message: 'Đăng ký ca làm thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        // If it's our custom quota error, send a 400
        const status = message.includes('tránh vượt quá') ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
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

        const regData = regSnap.data() as WeeklyRegistration;
        if (regData.userId !== decoded.uid) {
            return NextResponse.json({ error: 'Không được phép xóa đăng ký của người khác' }, { status: 403 });
        }

        // Server-side check: check if week is editable (must be next week or later)
        const currentWeekStartOfToday = new Date();
        const day = currentWeekStartOfToday.getDay();
        const diff = currentWeekStartOfToday.getDate() - day + (day === 0 ? -6 : 1);
        currentWeekStartOfToday.setDate(diff);
        currentWeekStartOfToday.setHours(0, 0, 0, 0);

        const minEditableWeekStart = new Date(currentWeekStartOfToday);
        minEditableWeekStart.setDate(minEditableWeekStart.getDate() + 7);

        const targetWeekStart = new Date(regData.weekStartDate + 'T00:00:00');

        if (targetWeekStart.getTime() !== minEditableWeekStart.getTime()) {
            return NextResponse.json({ error: 'Chỉ được phép xóa lịch cho đúng tuần đang mở đăng ký (Tuần tiếp theo)' }, { status: 403 });
        }

        await adminDb.collection('weekly_registrations').doc(registrationId).delete();
        return NextResponse.json({ message: 'Đã xóa đăng ký thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
