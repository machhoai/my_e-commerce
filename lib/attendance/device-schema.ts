import { z } from 'zod';

const deviceIdSchema = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Mã thiết bị chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang');

export const attendanceDeviceInputSchema = z.object({
    deviceId: deviceIdSchema,
    storeId: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(120),
    bridgeEndpoint: z.string().trim().url().max(500),
    isActive: z.boolean().default(true),
}).strict();

export const attendanceDeviceUpdateSchema = attendanceDeviceInputSchema
    .omit({ deviceId: true })
    .partial()
    .refine((value) => Object.keys(value).length > 0, 'Không có dữ liệu cần cập nhật');

export type AttendanceDeviceInput = z.infer<typeof attendanceDeviceInputSchema>;
