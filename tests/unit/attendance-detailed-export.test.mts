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
const shift = (rec: DailyAttendance, rules: RuleContainer = settings) => detailedAttendanceShifts(rec.date, rec, rules)[0];

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
    const row = workbook.getWorksheet(rec.zk_name)!.getRow(4);
    assert.equal(row.getCell(9).value, 'Thiếu checkout');
    assert.equal(row.getCell(10).value, null);
    assert.equal(row.getCell(12).value, null);
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
    const missingRules = detailedAttendanceShifts('2026-10-01', record('2026-10-01', '2026-10-01T09:00:00+07:00', '2026-10-01T16:00:00+07:00'), null)[0];
    assert.equal(missingRules.pending, true);
    assert.equal(missingRules.standardMinutes, null);
});

test('registered shifts do not duplicate or override the shift inferred from punches', () => {
    const results = detailedAttendanceShifts('2026-10-01', record('2026-10-01', '2026-10-01T09:00:00+07:00', '2026-10-01T23:00:00+07:00', {
        scheduledShiftIds: ['Ca 1', 'Ca 2', 'Ca 1'],
    }), settings);
    assert.equal(results.length, 1);
    assert.equal(results[0].shift, 'Ca 1');
    assert.equal(results[0].counted, true);
    const actual = shift(record('2026-10-01', '2026-10-01T16:00:00+07:00', '2026-10-01T23:00:00+07:00'));
    assert.equal(actual.shift, 'Ca 2');
    assert.equal(actual.workedMinutes, 420);
});

test('unpunched scheduled days and empty days do not export shifts', () => {
    const rec = record('2026-10-01', null, null, { absence: true });
    assert.deepEqual(detailedAttendanceShifts(rec.date, rec, settings), []);
    assert.deepEqual(detailedAttendanceShifts(rec.date, undefined, settings), []);
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

test('XLSX round trip includes total hours, missing checkout and full borders in both detail views', async () => {
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
    for (let row = 4; row <= 6; row++) assert.deepEqual(employee.getRow(row).values, combined.getRow(row).values);
    const headers = employee.getRow(3).values as unknown[];
    assert.ok(!headers.includes('Trạng thái ca'));
    assert.deepEqual(headers.slice(8, 11), ['Giờ chuẩn ca', 'Tổng giờ làm', 'Giờ làm trong ca']);
    assert.equal(employee.getCell('H4').value, 7);
    assert.equal(employee.getCell('I4').value, 7);
    assert.equal(employee.getCell('J4').value, 6.5);
    assert.equal(employee.getCell('K4').value, 30);
    assert.equal(employee.getCell('L4').value, 30);
    assert.equal(employee.getCell('H5').value, 8);
    assert.equal(employee.getCell('I6').value, 'Thiếu checkout');
    assert.equal(employee.getCell('J6').value, null);
    for (const sheet of [employee, combined, summary]) {
        for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
            assert.equal(sheet.getCell('B4').border[edge]?.style, 'thin');
        }
    }
});

test('employee names that collide with other sheets still export, including inactive staff', () => {
    const workbook = buildDetailedAttendanceWorkbook('2026-10', [
        record('2026-10-01', '2026-10-01T09:00:00+07:00', null),
        record('2026-10-01', '2026-10-01T09:00:00+07:00', null, { mapped_system_uid: 'u2', mapped_system_name: 'Tổng kết' }),
        record('2026-10-01', '2026-10-01T09:00:00+07:00', null, { mapped_system_uid: 'u3', mapped_system_name: 'Tổng kết' }),
    ], [{ uid: 'u1', name: 'Tổng kết' }], settings, now);
    assert.equal(workbook.worksheets.length, 5);
    assert.equal(new Set(workbook.worksheets.map(sheet => sheet.name)).size, 5);
});

test('export excludes registration-only employees and days while using actual shift policies', () => {
    const workbook = buildDetailedAttendanceWorkbook('2026-10', [
        record('2026-10-01', null, null, { absence: true }),
        record('2026-10-02', '2026-10-02T16:00:00+07:00', '2026-10-02T23:00:00+07:00'),
        record('2026-10-03', null, null, { mapped_system_uid: 'unpunched' }),
        record('2026-09-30', '2026-09-30T09:00:00+07:00', null, { mapped_system_uid: 'outside' }),
    ], [{ uid: 'u1', name: 'Đã nghỉ' }, { uid: 'unpunched', name: 'Chỉ đăng ký' }], settings, now);
    assert.equal(workbook.worksheets.length, 3);
    assert.equal(workbook.getWorksheet('Chỉ đăng ký'), undefined);
    const sheet = workbook.getWorksheet('Đã nghỉ')!;
    assert.equal(sheet.getCell('B4').value, '02/10/2026');
    assert.equal(sheet.getCell('D4').value, 'Ca 2');
    assert.equal(sheet.getCell('I4').value, 7);
    assert.equal(sheet.getCell('J4').value, 7);
    assert.match(String(sheet.getCell('A5').value), /^TỔNG KẾT:/);
});

test('total hours preserves overnight duration and marks incomplete or invalid punches', () => {
    const workbook = buildDetailedAttendanceWorkbook('2026-10', [
        record('2026-10-01', '2026-10-01T22:00:30+07:00', '2026-10-02T06:00:00+07:00'),
        record('2026-10-02', null, '2026-10-02T16:00:00+07:00'),
        record('2026-10-03', '2026-10-03T16:00:00+07:00', '2026-10-03T09:00:00+07:00'),
    ], [], settings, now);
    const sheet = workbook.getWorksheet('Nhân viên mẫu')!;
    assert.equal(sheet.getCell('I4').value, 8 - 30 / 3600);
    assert.equal(sheet.getCell('I4').numFmt, '0.00');
    assert.equal(sheet.getCell('I5').value, 'Thiếu checkin');
    assert.equal(sheet.getCell('D5').value, 'Ca 1');
    assert.equal(sheet.getCell('I6').value, 'Giờ vào/ra không hợp lệ');
});

test('weekend shift detection uses weekend hours even when registrations disagree', () => {
    const rules = { attendanceRules: { byShift: {
        'Ca 1': { defaultWeekday: weekday, defaultWeekend: { ...weekend, startTime: '15:00', endTime: '23:00' }, specialDates: {} },
        'Ca 2': { defaultWeekday: { ...weekday, startTime: '16:00', endTime: '23:00' }, defaultWeekend: weekend, specialDates: {} },
    } } };
    const result = shift(record('2026-10-03', '2026-10-03T09:00:00+07:00', '2026-10-03T17:00:00+07:00'), rules);
    assert.equal(result.shift, 'Ca 2');
    assert.equal(result.standardMinutes, 480);
    assert.equal(result.workedMinutes, 480);
});
