import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
// @ts-expect-error Node strip-types runner requires explicit extensions.
import { detailedAttendanceShifts } from '../../lib/attendance-rules.ts';
// @ts-expect-error Node strip-types runner requires explicit extensions.
import { buildDetailedAttendanceWorkbook } from '../../lib/attendance-detailed-export.ts';
// @ts-expect-error Node strip-types runner requires explicit extensions.
import { resolveAcceptedAttendanceTimes } from '../../lib/attendance/manager-model.ts';
import type { DailyAttendance } from '../../types/index';
import type { RuleContainer } from '../../lib/attendance-rules';

const weekday = { startTime: '09:00', endTime: '16:00', allowedEarlyMins: 5, allowedLateMins: 15 };
const weekend = { ...weekday, endTime: '17:00' };
const settings = { attendanceRules: { byShift: {
    'Ca 1': { defaultWeekday: weekday, defaultWeekend: weekend, specialDates: { '2026-10-02': weekend } },
    'Ca 2': { defaultWeekday: { ...weekday, startTime: '16:00', endTime: '23:00' }, defaultWeekend: weekend, specialDates: {} },
} } };
const now = new Date('2026-11-01T00:00:00+07:00');
function record(date: string, checkIn?: string | null, checkOut?: string | null, extra: Partial<DailyAttendance> = {}): DailyAttendance {
    return { zk_user_id: '1', mapped_system_uid: 'u1', zk_name: 'Nhân viên mẫu', date,
        checkIn, checkOut, punchCount: 2, scheduledShiftId: 'Ca 1', ...extra };
}
const shift = (rec: DailyAttendance, rules: RuleContainer = settings) => detailedAttendanceShifts(rec.date, rec, rules, now)[0];

test('expired software checkout exports as missing instead of eight hours and 1050.289 outside minutes', () => {
    const resolved = resolveAcceptedAttendanceTimes([
        { occurredAt: '2026-09-27T07:22:38.812Z', eventType: 'CHECK_IN', status: 'ACCEPTED', source: 'SOFTWARE' },
        { occurredAt: '2026-09-28T08:52:56.152Z', eventType: 'CHECK_OUT', status: 'ACCEPTED', source: 'SOFTWARE' },
    ], '2026-09-27');
    const rec = record('2026-09-27', resolved.checkIn, resolved.checkOut, { missingCheckOut: true });
    const rules = { attendanceRules: { byShift: {
        'Ca 1': { defaultWeekday: { ...weekday, startTime: '14:30', endTime: '22:30' },
            defaultWeekend: { ...weekend, startTime: '14:30', endTime: '22:30' }, specialDates: {} },
    } } };
    const result = shift(rec, rules);
    assert.equal(result.counted, false);
    assert.equal(result.workedMinutes, null);
    assert.equal(result.outsideMinutes, null);
    assert.match(result.label, /Thiếu giờ ra/);
    const workbook = buildDetailedAttendanceWorkbook('2026-09', [rec], [{ uid: 'u1', name: rec.zk_name }], rules, now);
    const row = workbook.getWorksheet(rec.zk_name)!.getRow(30);
    assert.equal(row.getCell(9).value, null);
    assert.equal(row.getCell(11).value, null);
    assert.match(String(row.getCell(12).value), /Thiếu giờ ra/);
});

test('configured weekday, weekend and special-date durations determine integer shift counts', () => {
    for (const date of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']) {
        const specialOrWeekend = date !== '2026-10-01';
        const result = shift(record(date, `${date}T09:00:00+07:00`, `${date}T${specialOrWeekend ? '17' : '16'}:00:00+07:00`));
        assert.equal(result.standardMinutes, specialOrWeekend ? 480 : 420);
        assert.equal(result.dayType, specialOrWeekend ? 'Cuối tuần/lễ' : 'Ngày thường');
        assert.equal(result.counted, true);
        assert.equal(result.label, 'Đủ giờ');
        assert.equal(result.missingMinutes, 0);
    }
});

test('late arrival and late departure remain separate; grace does not erase missing minutes', () => {
    const result = shift(record('2026-10-01', '2026-10-01T09:30:00+07:00', '2026-10-01T16:30:00+07:00'));
    assert.equal(result.counted, true);
    assert.equal(result.workedMinutes, 390);
    assert.equal(result.missingMinutes, 30);
    assert.equal(result.outsideMinutes, 30);
    assert.equal(result.label, 'Thiếu giờ');
    const withinGrace = shift(record('2026-10-01', '2026-10-01T09:10:00+07:00', '2026-10-01T15:56:00+07:00'));
    assert.equal(withinGrace.statusIn, 'ON_TIME');
    assert.equal(withinGrace.statusOut, 'ON_TIME_OUT');
    assert.equal(withinGrace.missingMinutes, 14);
});

test('outside time on either end cannot create additional shifts or hide short work', () => {
    const result = shift(record('2026-10-01', '2026-10-01T08:30:00+07:00', '2026-10-01T17:00:00+07:00'));
    assert.equal(result.workedMinutes, 420);
    assert.equal(result.outsideMinutes, 90);
    assert.equal(result.missingMinutes, 0);
    assert.equal(result.counted, true);
});

test('missing, reversed, invalid and outside-only punches require confirmation', () => {
    for (const [checkIn, checkOut] of [
        ['2026-10-01T09:00:00+07:00', null], [null, '2026-10-01T16:00:00+07:00'],
        ['2026-10-01T16:00:00+07:00', '2026-10-01T09:00:00+07:00'],
        ['bad', '2026-10-01T16:00:00+07:00'],
        ['2026-10-01T07:00:00+07:00', '2026-10-01T08:00:00+07:00'],
    ]) {
        const result = shift(record('2026-10-01', checkIn, checkOut));
        assert.equal(result.counted, false);
        assert.equal(result.pending, true);
        assert.equal(result.workedMinutes, null);
        assert.equal(result.missingMinutes, null);
    }
    const missingRules = detailedAttendanceShifts('2026-10-01', record('2026-10-01', '2026-10-01T09:00:00+07:00', '2026-10-01T16:00:00+07:00'), null, now)[0];
    assert.equal(missingRules.pending, true);
    assert.equal(missingRules.standardMinutes, null);
});

test('multiple scheduled shifts are shown separately and not inferred from daily FILO', () => {
    const results = detailedAttendanceShifts('2026-10-01', record('2026-10-01', '2026-10-01T09:00:00+07:00', '2026-10-01T23:00:00+07:00', {
        scheduledShiftIds: ['Ca 1', 'Ca 2', 'Ca 1'],
    }), settings, now);
    assert.equal(results.length, 2);
    assert.ok(results.every(result => result.pending && !result.counted));
});

test('unpunched scheduled days distinguish future shifts from absence and never count', () => {
    const rec = record('2026-10-01', null, null, { absence: true });
    assert.equal(shift(rec).label, 'Vắng');
    assert.equal(detailedAttendanceShifts(rec.date, rec, settings, new Date('2026-10-01T10:00:00+07:00'))[0].label, 'Chưa kết thúc ca');
    assert.equal(detailedAttendanceShifts(rec.date, undefined, settings, now)[0].label, '');
});

test('export shift detection resolves start time for the actual special date', () => {
    const changed = { attendanceRules: { byShift: {
        ...settings.attendanceRules.byShift,
        'Ca 1': { ...settings.attendanceRules.byShift['Ca 1'], specialDates: { '2026-10-02': { ...weekend, startTime: '15:00', endTime: '23:00' } } },
    } } };
    const result = shift(record('2026-10-02', '2026-10-02T15:00:00+07:00', '2026-10-02T23:00:00+07:00', { scheduledShiftId: null }), changed);
    assert.equal(result.shift, 'Ca 1');
    assert.equal(result.standardMinutes, 480);
    assert.equal(result.missingMinutes, 0);
});

test('overnight shift and seconds retain their exact duration', () => {
    const overnight = { attendanceRules: { byShift: { 'Ca 1': {
        defaultWeekday: { ...weekday, startTime: '22:00', endTime: '06:00' },
        defaultWeekend: weekend, specialDates: {},
    } } } };
    const result = shift(record('2026-10-01', '2026-10-01T22:00:30+07:00', '2026-10-02T06:00:00+07:00'), overnight);
    assert.equal(result.standardMinutes, 480);
    assert.equal(result.missingMinutes, 0.5);
});

test('XLSX round trip reconciles summary and both detail views without total hours', async () => {
    const attendance = [
        record('2026-10-01', '2026-10-01T09:30:00+07:00', '2026-10-01T16:30:00+07:00'),
        record('2026-10-02', '2026-10-02T09:00:00+07:00', '2026-10-02T17:00:00+07:00'),
        record('2026-10-03', '2026-10-03T09:00:00+07:00', null),
    ];
    const workbook = buildDetailedAttendanceWorkbook('2026-10', attendance, [{ uid: 'u1', name: 'Nhân viên mẫu' }], settings, now);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const summary = loaded.getWorksheet('Tổng kết')!;
    assert.deepEqual((summary.getRow(3).values as unknown[]).slice(1), [1, 'Nhân viên mẫu', 1, 1, 1, 1, 1, 0, 30, 30]);
    assert.ok(!(summary.getRow(2).values as unknown[]).includes('Tổng giờ làm'));
    assert.equal(summary.getCell('I3').numFmt, '0.00');
    assert.equal(summary.getCell('C4').value, 1);
    const employee = loaded.getWorksheet('Nhân viên mẫu')!;
    const combined = loaded.getWorksheet('Tổng hợp chi tiết')!;
    for (let row = 4; row <= 34; row++) assert.deepEqual(employee.getRow(row).values, combined.getRow(row).values);
    assert.equal(employee.getCell('H4').value, 7);
    assert.equal(employee.getCell('I4').value, 6.5);
    assert.equal(employee.getCell('J4').value, 30);
    assert.equal(employee.getCell('K4').value, 30);
    assert.equal(employee.getCell('H5').value, 8);
    assert.equal(employee.getCell('I6').value, null);
});

test('employee names that collide with other sheets still export, including inactive staff', () => {
    const workbook = buildDetailedAttendanceWorkbook('2026-10', [
        record('2026-10-01', null, null),
        record('2026-10-01', null, null, { mapped_system_uid: 'u2', mapped_system_name: 'Tổng kết' }),
        record('2026-10-01', null, null, { mapped_system_uid: 'u3', mapped_system_name: 'Tổng kết' }),
    ], [{ uid: 'u1', name: 'Tổng kết' }], settings, now);
    assert.equal(workbook.worksheets.length, 5);
    assert.equal(new Set(workbook.worksheets.map(sheet => sheet.name)).size, 5);
});
