import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    attendanceServiceErrorResponse,
    punchSoftwareAttendance,
} from '@/lib/attendance/software-service';

const punchInputSchema = z
    .object({
        storeId: z.string().trim().min(1).optional(),
        eventType: z.enum(['CHECK_IN', 'CHECK_OUT']),
        idempotencyKey: z.string().uuid(),
        location: z
            .object({
                latitude: z.number().min(-90).max(90),
                longitude: z.number().min(-180).max(180),
                accuracyM: z.number().nonnegative().max(10_000),
                capturedAt: z.string().datetime(),
            })
            .strict()
            .optional(),
    })
    .strict();

export async function POST(req: NextRequest) {
    try {
        const input = punchInputSchema.parse(await req.json());
        const result = await punchSoftwareAttendance(req, input);
        return NextResponse.json(result, { status: result.created ? 201 : 200 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Dữ liệu chấm công không hợp lệ.', details: error.flatten() },
                { status: 400 },
            );
        }
        const response = attendanceServiceErrorResponse(error);
        if (response) return response;
        console.error('[attendance-punch] error:', error);
        return NextResponse.json({ error: 'Không thể thực hiện chấm công.' }, { status: 500 });
    }
}
