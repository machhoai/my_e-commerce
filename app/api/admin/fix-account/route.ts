import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET() {
    try {
        // Thay bằng UID bạn copy trên Firebase
        const targetUid = 'RyYdz8NWxseQjZg67gzGpGaQcEf1';

        // Thay bằng SĐT chuẩn của ông ấy nối với @company.com
        const pseudoEmail = '0938571951@company.com';

        await getAdminAuth().updateUser(targetUid, {
            email: pseudoEmail
        });

        return NextResponse.json({
            success: true,
            message: `Đã khôi phục thành công tài khoản về ${pseudoEmail}`
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}