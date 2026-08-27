import { isIP } from 'node:net';
import { z } from 'zod';

const ipAddressSchema = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((value) => isIP(value.replace(/^::ffff:/i, '')) !== 0, 'Địa chỉ IP không hợp lệ');

export const attendancePolicyInputSchema = z
    .object({
        enabled: z.boolean(),
        sourceMode: z.enum(['MACHINE', 'SOFTWARE']),
        verificationMethod: z.enum(['GPS', 'IP']).nullable(),
        allowedIpAddresses: z.array(ipAddressSchema).max(20).default([]),
        gps: z
            .object({
                latitude: z.number().min(-90).max(90),
                longitude: z.number().min(-180).max(180),
                radiusM: z.number().int().min(20).max(5_000),
                maxAccuracyM: z.number().int().min(10).max(1_000),
                maxAgeSeconds: z.number().int().min(30).max(900),
            })
            .strict()
            .nullable(),
        requireCheckOut: z.boolean(),
    })
    .strict()
    .superRefine((value, context) => {
        if (value.sourceMode === 'MACHINE') {
            if (value.verificationMethod !== null) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['verificationMethod'],
                    message: 'Cửa hàng dùng máy chấm công không cấu hình GPS/IP',
                });
            }
            if (value.allowedIpAddresses.length > 0 || value.gps !== null) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['sourceMode'],
                    message: 'Cấu hình máy chấm công không được chứa cấu hình GPS/IP',
                });
            }
            return;
        }

        if (value.verificationMethod === 'GPS') {
            if (!value.gps) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['gps'],
                    message: 'Thiếu cấu hình GPS',
                });
            }
            if (value.allowedIpAddresses.length > 0) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['allowedIpAddresses'],
                    message: 'Phương thức GPS không sử dụng danh sách IP',
                });
            }
            return;
        }

        if (value.verificationMethod === 'IP') {
            if (value.allowedIpAddresses.length === 0) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['allowedIpAddresses'],
                    message: 'Cần ít nhất một địa chỉ IP được phép',
                });
            }
            if (value.gps !== null) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['gps'],
                    message: 'Phương thức IP không sử dụng cấu hình GPS',
                });
            }
            return;
        }

        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['verificationMethod'],
            message: 'Cửa hàng chấm công phần mềm phải chọn GPS hoặc IP',
        });
    });

export type AttendancePolicyInput = z.infer<typeof attendancePolicyInputSchema>;
