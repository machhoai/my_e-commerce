import { z } from 'zod';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có định dạng HH:mm');
const attendanceRuleSchema = z.object({
    startTime: timeSchema,
    endTime: timeSchema,
    allowedEarlyMins: z.number().int().min(0).max(720),
    allowedLateMins: z.number().int().min(0).max(720),
}).strict();

const ruleSetSchema = z.object({
    defaultWeekday: attendanceRuleSchema,
    defaultWeekend: attendanceRuleSchema,
    specialDates: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), attendanceRuleSchema),
}).strict();

export const attendanceRulesInputSchema = z.object({
    byShift: z.record(z.string().trim().min(1).max(100), ruleSetSchema),
}).strict();
