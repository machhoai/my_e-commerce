'use client';

/**
 * /manager/hr/attendance
 *
 * Dual-view Attendance Roster:
 *
 * Inner Tab 1 — "Bảng tính công" (Calculated View)
 *   Day mode  : Displays FILO-resolved check-in/out + working hours,
 *               coloring the check-in cell by EARLY/ON_TIME/LATE status.
 *   Month mode: Grid with status-colored check-in times per cell.
 *
 * Inner Tab 2 — "Lịch sử chạm" (Raw Punch History)
 *   Day mode only: Lists all raw timestamps per employee chronologically.
 *   Pure device output — no calculation, no status.
 *
 * Export (Calculated View):
 *   exceljs workbook with multi-level headers, merged date cells,
 *   and colored check-in cells matching the status engine output.
 *
 * Status Engine: lib/attendance-rules.ts
 *   EARLY   → #3B82F6 (blue)
 *   ON_TIME → #22C55E (green)
 *   LATE    → #EF4444 (red)
 *   UNKNOWN → #6B7280 (gray)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { UserDoc, DailyAttendance, ZkUserDoc, SettingsDoc, AttendanceRule, AttendanceRuleSet } from '@/types';
import {
    Clock, RefreshCw, Download, CalendarDays, CalendarRange,
    ChevronLeft, ChevronRight, Search, ListOrdered, BarChart3,
    Settings2, Plus, Trash2, X, Save, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    calculateAttendanceStatus,
    PunchStatus,
    PunchOutStatus,
    BLANK_RULE_SET,
} from '@/lib/attendance-rules';
import type { RawPunchGroup } from '@/app/api/hr/raw-punches/route';
import ExcelJS from 'exceljs';
import EmployeeProfilePopup from '@/components/shared/EmployeeProfilePopup';

// ─────────────────────────────────────────────────────────────────────────────
// Date / formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function todayDate() { return new Date().toISOString().slice(0, 10); }
function currentMonth() { return new Date().toISOString().slice(0, 7); }

function formatTime(isoStr: string | null | undefined): string {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function daysInMonth(month: string): number {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

function prevMonth(m: string): string {
    const d = new Date(`${m}-01`); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
}

function nextMonth(m: string): string {
    const d = new Date(`${m}-01`); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// Status → visual tokens
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<PunchStatus, { bg: string; text: string; hex: string; label: string }> = {
    EARLY:   { bg: 'bg-blue-50',   text: 'text-blue-700',   hex: '#3B82F6', label: 'Vào sớm' },
    ON_TIME: { bg: 'bg-green-50',  text: 'text-green-700',  hex: '#22C55E', label: 'Đúng giờ' },
    LATE:    { bg: 'bg-red-50',    text: 'text-red-700',    hex: '#EF4444', label: 'Vào trễ' },
    UNKNOWN: { bg: 'bg-surface-50',text: 'text-surface-500',hex: '#6B7280', label: '—' },
};

const CHECKOUT_STATUS_COLORS: Record<PunchOutStatus, { bg: string; text: string; hex: string; label: string }> = {
    EARLY_OUT:   { bg: 'bg-amber-50',   text: 'text-amber-700',   hex: '#F59E0B', label: 'Về sớm' },
    ON_TIME_OUT: { bg: 'bg-green-50',   text: 'text-green-700',   hex: '#22C55E', label: 'Đúng giờ' },
    OVERTIME:    { bg: 'bg-purple-50',  text: 'text-purple-700',  hex: '#8B5CF6', label: 'Tăng ca' },
    UNKNOWN:     { bg: 'bg-surface-50', text: 'text-surface-500', hex: '#6B7280', label: '—' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type DateMode = 'day' | 'month';
type InnerTab = 'calculated' | 'raw';

export default function AttendancePage() {
    const { user, userDoc, hasPermission } = useAuth();

    // ── RBAC guard ─────────────────────────────────────────────────────────────
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const canView = isAdmin || hasPermission('page.hr.attendance');
    const canConfigure = isAdmin || hasPermission('hr.attendance.configure');

    const [dateMode, setDateMode] = useState<DateMode>('day');
    const [innerTab, setInnerTab] = useState<InnerTab>('calculated');
    const [selectedDate, setSelectedDate] = useState(todayDate());
    const [selectedMonth, setSelectedMonth] = useState(currentMonth());
    const [search, setSearch] = useState('');

    // Data
    const [attendance, setAttendance] = useState<DailyAttendance[]>([]);
    const [rawPunches, setRawPunches] = useState<RawPunchGroup[]>([]);
    const [zkUsers, setZkUsers] = useState<ZkUserDoc[]>([]);
    const [allEmployees, setAllEmployees] = useState<UserDoc[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);

    // Loading states
    const [fetchingCalc, setFetchingCalc] = useState(false);
    const [fetchingRaw, setFetchingRaw] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Popup state ────────────────────────────────────────────────────────────────
    const [popupEmployee, setPopupEmployee] = useState<UserDoc | null>(null);

    const getToken = useCallback(async () => user?.getIdToken() ?? '', [user]);

    // ── Attendance Rules panel state ────────────────────────────────────────────

    // shiftRules: { [shiftName]: { weekday, weekend, specialDates[] } }
    type ShiftFormEntry = {
        weekday: AttendanceRule;
        weekend: AttendanceRule;
        specialDates: { date: string; rule: AttendanceRule }[];
    };

    const [showRulesPanel, setShowRulesPanel] = useState(false);
    const [savingRules, setSavingRules] = useState(false);
    const [rulesSaved, setRulesSaved] = useState(false);
    const [expandedShift, setExpandedShift] = useState<string | null>(null);
    // The editable form state: one entry per shift name from shiftTimes
    const [shiftRules, setShiftRules] = useState<Record<string, ShiftFormEntry>>({});

    // Build the list of shifts from settings.shiftTimes (falls back to ['Ca 1'])
    const shiftNames = useMemo(
        () => (settings as SettingsDoc & { shiftTimes?: string[] })?.shiftTimes?.length
            ? (settings as SettingsDoc & { shiftTimes?: string[] }).shiftTimes!
            : ['Ca 1'],
        [settings]
    );

    // When panel opens: populate shiftRules from Firestore data
    useEffect(() => {
        if (!showRulesPanel) return;
        const byShift = settings?.attendanceRules?.byShift ?? {};
        const next: Record<string, ShiftFormEntry> = {};
        for (const name of shiftNames) {
            const saved = byShift[name];
            next[name] = {
                weekday:      saved?.defaultWeekday  ?? { ...BLANK_RULE_SET.defaultWeekday },
                weekend:      saved?.defaultWeekend  ?? { ...BLANK_RULE_SET.defaultWeekend },
                specialDates: Object.entries(saved?.specialDates ?? {}).map(([date, rule]) => ({ date, rule: rule as AttendanceRule })),
            };
        }
        setShiftRules(next);
        // Expand the first shift by default
        setExpandedShift(shiftNames[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showRulesPanel, settings, shiftNames]);

    const handleSaveRules = useCallback(async () => {
        setSavingRules(true);
        try {
            const byShift: Record<string, AttendanceRuleSet> = {};
            for (const [name, entry] of Object.entries(shiftRules)) {
                const specialDatesRecord: Record<string, AttendanceRule> = {};
                for (const { date, rule } of entry.specialDates) {
                    if (date.trim()) specialDatesRecord[date.trim()] = rule;
                }
                byShift[name] = {
                    defaultWeekday: entry.weekday,
                    defaultWeekend: entry.weekend,
                    specialDates: specialDatesRecord,
                };
            }
            await setDoc(
                doc(db, 'settings', 'global'),
                { attendanceRules: { byShift } },
                { merge: true }
            );
            setRulesSaved(true);
            setTimeout(() => setRulesSaved(false), 2500);
        } catch (e) {
            console.error('Save rules error:', e);
        } finally {
            setSavingRules(false);
        }
    }, [shiftRules]);

    /** Patch a single rule field inside a shift's weekday or weekend rule */
    function patchShiftRule(
        shiftName: string,
        kind: 'weekday' | 'weekend',
        field: keyof AttendanceRule,
        value: string | number
    ) {
        const coerced = (field === 'allowedEarlyMins' || field === 'allowedLateMins')
            ? Number(value) : value;
        setShiftRules((prev) => ({
            ...prev,
            [shiftName]: {
                ...prev[shiftName],
                [kind]: { ...prev[shiftName]?.[kind], [field]: coerced },
            },
        }));
    }

    /** Patch a field inside one special-date row of a shift */
    function patchShiftSpecial(
        shiftName: string,
        idx: number,
        field: keyof AttendanceRule,
        value: string | number
    ) {
        const coerced = (field === 'allowedEarlyMins' || field === 'allowedLateMins')
            ? Number(value) : value;
        setShiftRules((prev) => {
            const entries = [...(prev[shiftName]?.specialDates ?? [])];
            entries[idx] = { ...entries[idx], rule: { ...entries[idx].rule, [field]: coerced } };
            return { ...prev, [shiftName]: { ...prev[shiftName], specialDates: entries } };
        });
    }

    function addSpecialDate(shiftName: string) {
        setShiftRules((prev) => ({
            ...prev,
            [shiftName]: {
                ...prev[shiftName],
                specialDates: [
                    ...(prev[shiftName]?.specialDates ?? []),
                    { date: '', rule: { ...prev[shiftName]?.weekday ?? BLANK_RULE_SET.defaultWeekday } },
                ],
            },
        }));
    }

    function removeSpecialDate(shiftName: string, idx: number) {
        setShiftRules((prev) => ({
            ...prev,
            [shiftName]: {
                ...prev[shiftName],
                specialDates: (prev[shiftName]?.specialDates ?? []).filter((_, i) => i !== idx),
            },
        }));
    }

    function setSpecialDate(shiftName: string, idx: number, date: string) {
        setShiftRules((prev) => {
            const entries = [...(prev[shiftName]?.specialDates ?? [])];
            entries[idx] = { ...entries[idx], date };
            return { ...prev, [shiftName]: { ...prev[shiftName], specialDates: entries } };
        });
    }

    // ── Real-time listeners ────────────────────────────────────────────────────

    useEffect(() => {
        const q = query(collection(db, 'users'), where('isActive', '!=', false));
        return onSnapshot(q, (snap) => {
            const docs = snap.docs
                .map((d) => d.data() as UserDoc)
                .filter((u) => u.role !== 'admin' && u.role !== 'super_admin');
            docs.sort((a, b) => a.name.localeCompare(b.name));
            setAllEmployees(docs);
        });
    }, []);

    useEffect(() => {
        return onSnapshot(collection(db, 'zkteco_users'), (snap) => {
            setZkUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ZkUserDoc)));
        });
    }, []);

    // Load global settings for attendance rules
    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'settings'),
            (snap) => {
                const globalDoc = snap.docs.find((d) => d.id === 'global');
                setSettings(globalDoc ? (globalDoc.data() as SettingsDoc) : null);
            }
        );
        return unsub;
    }, []);

    // ── Fetch calculated attendance ────────────────────────────────────────────

    const fetchAttendance = useCallback(async () => {
        setFetchingCalc(true);
        setError(null);
        try {
            const token = await getToken();
            const param = dateMode === 'day' ? `date=${selectedDate}` : `month=${selectedMonth}`;
            const res = await fetch(`/api/hr/attendance?${param}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? 'Lỗi tải dữ liệu');
            }
            setAttendance(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setFetchingCalc(false);
        }
    }, [getToken, dateMode, selectedDate, selectedMonth]);

    // ── Fetch raw punches (day mode + raw tab only) ────────────────────────────

    const fetchRawPunches = useCallback(async () => {
        if (dateMode !== 'day') return;
        setFetchingRaw(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`/api/hr/raw-punches?date=${selectedDate}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error ?? 'Lỗi tải lịch sử chạm');
            }
            setRawPunches(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setFetchingRaw(false);
        }
    }, [getToken, dateMode, selectedDate]);

    useEffect(() => { fetchAttendance(); }, [fetchAttendance]);
    useEffect(() => {
        if (innerTab === 'raw') fetchRawPunches();
    }, [innerTab, fetchRawPunches]);

    // ── Sync from device ───────────────────────────────────────────────────────

    const handleSync = useCallback(async () => {
        setSyncing(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/hr/sync-attendance', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            await Promise.all([fetchAttendance(), fetchRawPunches()]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Lỗi đồng bộ');
        } finally {
            setSyncing(false);
        }
    }, [getToken, fetchAttendance, fetchRawPunches]);

    // ── Lookup maps ────────────────────────────────────────────────────────────

    const attendanceByUidAndDate = useMemo(() => {
        const map = new Map<string, DailyAttendance>();
        for (const a of attendance) {
            if (a.mapped_system_uid) map.set(`${a.mapped_system_uid}|${a.date}`, a);
        }
        return map;
    }, [attendance]);

    const mappedZkByUid = useMemo(() => {
        const map = new Map<string, ZkUserDoc>();
        for (const z of zkUsers) {
            if (z.status === 'mapped' && z.mapped_system_uid) map.set(z.mapped_system_uid, z);
        }
        return map;
    }, [zkUsers]);

    const mappedEmployees = useMemo(
        () => allEmployees.filter((e) => mappedZkByUid.has(e.uid)),
        [allEmployees, mappedZkByUid]
    );

    const filteredEmployees = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return mappedEmployees;
        return mappedEmployees.filter(
            (e) => e.name.toLowerCase().includes(q) || e.phone.includes(q)
        );
    }, [mappedEmployees, search]);

    // Day mode: only employees with punch data
    const dayFilteredEmployees = useMemo(() => {
        if (dateMode !== 'day') return filteredEmployees;
        return filteredEmployees.filter((e) =>
            attendanceByUidAndDate.has(`${e.uid}|${selectedDate}`)
        );
    }, [dateMode, filteredEmployees, attendanceByUidAndDate, selectedDate]);

    const monthDays = useMemo(() => {
        const n = daysInMonth(selectedMonth);
        return Array.from({ length: n }, (_, i) => i + 1);
    }, [selectedMonth]);

    // ── Status helper (memoized per cell) ─────────────────────────────────────

    function getStatus(checkIn?: string | null, checkOut?: string | null, date?: string) {
        if (!checkIn || !date) return 'UNKNOWN' as PunchStatus;
        return calculateAttendanceStatus(checkIn, checkOut, date, settings).status;
    }

    // ── exceljs Export ────────────────────────────────────────────────────────

    const handleExport = useCallback(async () => {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'B.Duck Cityfuns ERP';
        wb.created = new Date();

        const thinBorder: ExcelJS.Border = { style: 'thin', color: { argb: 'FFD1D5DB' } };
        const allBorders: Partial<ExcelJS.Borders> = {
            top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder,
        };
        const headerFill: ExcelJS.Fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' },
        };

        if (dateMode === 'day') {
            // ══ Day mode sheet ══════════════════════════════════════════════
            const ws = wb.addWorksheet(`Chấm công ${selectedDate}`);
            const [, mm, dd] = selectedDate.split('-');
            const dayLabel = `${dd}/${mm}`;

            // Row 1: merged date header
            ws.columns = [
                { key: 'id', width: 10 },
                { key: 'name', width: 24 },
                { key: 'in', width: 9 },
                { key: 'out', width: 9 },
                { key: 'hours', width: 11 },
            ];

            const titleRow = ws.addRow(['Mã ZK', 'Họ Tên', dayLabel, '', '']);
            ws.mergeCells(`C1:E1`);
            titleRow.eachCell((cell) => {
                cell.font = { bold: true, size: 11 };
                cell.fill = headerFill;
                cell.border = allBorders;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            const subRow = ws.addRow(['', '', 'Vào', 'Ra', 'Giờ làm']);
            subRow.eachCell((cell) => {
                cell.font = { bold: true, size: 10 };
                cell.fill = headerFill;
                cell.border = allBorders;
                cell.alignment = { horizontal: 'center' };
            });
            subRow.getCell('A').font = { bold: true };
            subRow.getCell('B').font = { bold: true };

            // Data rows
            for (const emp of dayFilteredEmployees) {
                const rec = attendanceByUidAndDate.get(`${emp.uid}|${selectedDate}`)!;
                const statusResult = calculateAttendanceStatus(
                    rec.checkIn!, rec.checkOut, selectedDate, settings
                );
                const inTime = formatTime(rec.checkIn);
                const outTime = formatTime(rec.checkOut);

                const row = ws.addRow([
                    mappedZkByUid.get(emp.uid)?.zk_user_id ?? '',
                    emp.name,
                    inTime !== '—' ? inTime : '',
                    outTime !== '—' ? outTime : '',
                    statusResult.workHours ?? '',
                ]);
                row.eachCell((cell) => { cell.border = allBorders; cell.alignment = { vertical: 'middle' }; });

                // Color the check-in cell
                const token = STATUS_COLORS[statusResult.status];
                row.getCell('C').font = { color: { argb: 'FF' + token.hex.slice(1) }, bold: true };
                row.getCell('C').alignment = { horizontal: 'center' };

                // Color the check-out cell
                if (rec.checkOut) {
                    const outToken = CHECKOUT_STATUS_COLORS[statusResult.checkOutStatus];
                    row.getCell('D').font = { color: { argb: 'FF' + outToken.hex.slice(1) }, bold: true };
                }
                row.getCell('D').alignment = { horizontal: 'center' };
                row.getCell('E').numFmt = '0.00';
                row.getCell('E').alignment = { horizontal: 'center' };
            }

            ws.getRow(1).height = 20;
            ws.getRow(2).height = 18;

        } else {
            // ══ Month mode sheet ════════════════════════════════════════════
            const ws = wb.addWorksheet(`Tháng ${selectedMonth}`);
            const [, mm] = selectedMonth.split('-');

            // Build columns descriptor
            const cols: Partial<ExcelJS.Column>[] = [
                { key: 'id', width: 10 },
                { key: 'name', width: 24 },
            ];
            for (const d of monthDays) {
                cols.push({ key: `d${d}_in`, width: 8 });
                cols.push({ key: `d${d}_out`, width: 8 });
                cols.push({ key: `d${d}_h`, width: 9 });
            }
            ws.columns = cols;

            // Row 1: identity headers + merged date labels
            const row1Values: (string | number)[] = ['Mã ZK', 'Họ Tên'];
            for (const d of monthDays) {
                row1Values.push(`${String(d).padStart(2,'0')}/${mm}`, '', '');
            }
            const headerRow1 = ws.addRow(row1Values);
            headerRow1.eachCell((cell) => {
                cell.font = { bold: true, size: 10 };
                cell.fill = headerFill;
                cell.border = allBorders;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            // Merge date label across its 3 columns
            monthDays.forEach((d, i) => {
                const startCol = 3 + i * 3;  // 1-indexed
                ws.mergeCells(1, startCol, 1, startCol + 2);
            });

            // Row 2: sub-headers
            const row2Values: string[] = ['', ''];
            for (const _ of monthDays) { row2Values.push('Vào', 'Ra', 'Giờ làm'); }
            const headerRow2 = ws.addRow(row2Values);
            headerRow2.eachCell((cell) => {
                cell.font = { bold: true, size: 9 };
                cell.fill = headerFill;
                cell.border = allBorders;
                cell.alignment = { horizontal: 'center' };
            });

            // Data rows
            for (const emp of filteredEmployees) {
                const cellValues: (string | number)[] = [
                    mappedZkByUid.get(emp.uid)?.zk_user_id ?? '',
                    emp.name,
                ];
                const cellMeta: { colIndex: number; hex: string }[] = [];

                let colOffset = 3; // 1-indexed start of day columns
                for (const d of monthDays) {
                    const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                    const rec = attendanceByUidAndDate.get(`${emp.uid}|${dateStr}`);
                    const inTime = formatTime(rec?.checkIn);
                    const outTime = formatTime(rec?.checkOut);

                    if (rec?.checkIn) {
                        const statusResult = calculateAttendanceStatus(
                            rec.checkIn, rec.checkOut, dateStr, settings
                        );
                        cellValues.push(
                            inTime !== '—' ? inTime : '',
                            outTime !== '—' ? outTime : '',
                            statusResult.workHours ?? '',
                        );
                        cellMeta.push({ colIndex: colOffset, hex: STATUS_COLORS[statusResult.status].hex });
                    } else {
                        cellValues.push('', '', '');
                    }
                    colOffset += 3;
                }

                const dataRow = ws.addRow(cellValues);
                dataRow.eachCell((cell, colNumber) => {
                    cell.border = allBorders;
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    // Style hours columns (every 3rd starting at col 5)
                    if (colNumber >= 5 && (colNumber - 5) % 3 === 2) {
                        cell.numFmt = '0.00';
                    }
                });

                // Apply status color to check-in cells
                for (const { colIndex, hex } of cellMeta) {
                    dataRow.getCell(colIndex).font = {
                        color: { argb: 'FF' + hex.slice(1) },
                        bold: true,
                        size: 9,
                    };
                }
            }

            ws.getRow(1).height = 22;
            ws.getRow(2).height = 16;
        }

        // Trigger download as blob
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chamcong_${dateMode === 'day' ? selectedDate : selectedMonth}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    }, [
        dateMode, dayFilteredEmployees, filteredEmployees, attendanceByUidAndDate,
        mappedZkByUid, selectedDate, selectedMonth, monthDays, settings,
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Render helpers
    // ─────────────────────────────────────────────────────────────────────────

    const isBusy = fetchingCalc || syncing;

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    // Access denied view
    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Không có quyền truy cập</h2>
                <p className="text-sm text-gray-500 max-w-xs">
                    Trang chấm công chỉ dành cho những người được cấp quyền. Vui lòng liên hệ quản trị viên.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* ── Header Controls ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary-600" />
                            Chấm Công Máy ZKTeco
                        </h1>
                        <p className="text-surface-500 text-sm mt-0.5">
                            {mappedEmployees.length} nhân viên đã ghép · FILO logic · Phân loại sớm/đúng/trễ
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Date mode toggle */}
                        <div className="flex bg-surface-100 rounded-xl p-1 gap-1">
                            {(['day', 'month'] as DateMode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setDateMode(m)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                                        dateMode === m ? 'bg-white shadow-sm text-primary-700' : 'text-surface-500 hover:text-surface-700'
                                    )}
                                >
                                    {m === 'day' ? <CalendarDays className="w-4 h-4" /> : <CalendarRange className="w-4 h-4" />}
                                    {m === 'day' ? 'Ngày' : 'Tháng'}
                                </button>
                            ))}
                        </div>

                        {/* Date/Month picker */}
                        {dateMode === 'day' ? (
                            <input
                                type="date" value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                            />
                        ) : (
                            <div className="flex items-center gap-1 border border-surface-200 rounded-xl overflow-hidden bg-white">
                                <button onClick={() => setSelectedMonth(prevMonth(selectedMonth))} className="p-2 hover:bg-surface-100 transition-colors">
                                    <ChevronLeft className="w-4 h-4 text-surface-500" />
                                </button>
                                <input
                                    type="month" value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="text-sm font-medium py-2 px-1 bg-transparent focus:outline-none text-surface-700 min-w-[130px] text-center"
                                />
                                <button onClick={() => setSelectedMonth(nextMonth(selectedMonth))} className="p-2 hover:bg-surface-100 transition-colors">
                                    <ChevronRight className="w-4 h-4 text-surface-500" />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={handleExport}
                            disabled={filteredEmployees.length === 0}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border bg-surface-50 text-surface-700 border-surface-200 hover:bg-surface-100 disabled:opacity-40 transition-all"
                        >
                            <Download className="w-4 h-4" />
                            Excel
                        </button>

                        {canConfigure && (
                            <button
                                onClick={() => setShowRulesPanel(true)}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-all"
                                title="Cài đặt quy tắc chấm công"
                            >
                                <Settings2 className="w-4 h-4" />
                                Quy tắc
                            </button>
                        )}

                        <button
                            onClick={handleSync}
                            disabled={isBusy}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-primary-600 to-accent-600 text-white hover:from-primary-700 hover:to-accent-700 shadow-md shadow-primary-500/20 transition-all disabled:opacity-60"
                        >
                            <RefreshCw className={cn('w-4 h-4', isBusy && 'animate-spin')} />
                            {syncing ? 'Đang đồng bộ…' : fetchingCalc ? 'Đang tải…' : 'Đồng bộ & Làm mới'}
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-4 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Lọc theo tên nhân viên..."
                        className="w-full pl-10 pr-4 py-2 bg-surface-50 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                </div>

                {/* Status legend */}
                <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="text-surface-400 font-medium w-14 shrink-0">Vào:</span>
                        {(Object.entries(STATUS_COLORS) as [PunchStatus, typeof STATUS_COLORS[PunchStatus]][]).filter(([k]) => k !== 'UNKNOWN').map(([key, t]) => (
                            <span key={key} className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg', t.bg, t.text, 'font-medium')}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.hex }} />
                                {t.label}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="text-surface-400 font-medium w-14 shrink-0">Ra:</span>
                        {(Object.entries(CHECKOUT_STATUS_COLORS) as [PunchOutStatus, typeof CHECKOUT_STATUS_COLORS[PunchOutStatus]][]).filter(([k]) => k !== 'UNKNOWN').map(([key, t]) => (
                            <span key={key} className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg', t.bg, t.text, 'font-medium')}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.hex }} />
                                {t.label}
                            </span>
                        ))}
                        <span className="ml-auto text-surface-400 italic text-[11px]">
                            * Giờ làm tính từ startTime, giờ ra cập tại endTime
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
                    ⚠️ {error}
                </div>
            )}

            {/* ── Inner Tab Bar (Day mode only) ────────────────────────────── */}
            {dateMode === 'day' && (
                <div className="flex gap-1 bg-surface-100 rounded-xl p-1 w-fit">
                    <button
                        onClick={() => setInnerTab('calculated')}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            innerTab === 'calculated'
                                ? 'bg-white shadow-sm text-primary-700'
                                : 'text-surface-500 hover:text-surface-700'
                        )}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Bảng tính công
                    </button>
                    <button
                        onClick={() => setInnerTab('raw')}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            innerTab === 'raw'
                                ? 'bg-white shadow-sm text-primary-700'
                                : 'text-surface-500 hover:text-surface-700'
                        )}
                    >
                        <ListOrdered className="w-4 h-4" />
                        Lịch sử chạm
                        {rawPunches.length > 0 && (
                            <span className="bg-primary-100 text-primary-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {rawPunches.reduce((s, g) => s + g.timestamps.length, 0)}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                TAB 1 — CALCULATED VIEW (Day + Month)
            ════════════════════════════════════════════════════════════════ */}
            {(dateMode === 'month' || innerTab === 'calculated') && (
                <>
                    {/* DAY MODE TABLE */}
                    {dateMode === 'day' && (
                        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-surface-100 flex items-center justify-between">
                                <p className="text-sm font-semibold text-surface-700">
                                    {new Date(selectedDate + 'T00:00').toLocaleDateString('vi-VN', {
                                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                                    })}
                                </p>
                                <p className="text-xs text-surface-400">
                                    {dayFilteredEmployees.length} người có dữ liệu chấm công
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-surface-50 border-b border-surface-200 text-xs uppercase tracking-wider text-surface-500">
                                        <tr>
                                            <th className="px-5 py-3.5 text-left font-bold">Nhân viên</th>
                                            <th className="px-4 py-3.5 text-center font-bold">Trạng thái</th>
                                            <th className="px-4 py-3.5 text-center font-bold">Giờ vào (thực)</th>
                                            <th className="px-4 py-3.5 text-center font-bold">Tính từ</th>
                                            <th className="px-4 py-3.5 text-center font-bold">Giờ ra</th>
                                            <th className="px-4 py-3.5 text-center font-bold">Giờ làm</th>
                                            <th className="px-4 py-3.5 text-center font-bold">Số lần quét</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-100">
                                        {fetchingCalc ? (
                                            <tr><td colSpan={7} className="py-16 text-center">
                                                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                            </td></tr>
                                        ) : dayFilteredEmployees.length === 0 ? (
                                            <tr><td colSpan={7} className="py-16 text-center text-surface-400 text-sm">
                                                Không có dữ liệu chấm công nào trong ngày này.
                                            </td></tr>
                                        ) : (
                                            dayFilteredEmployees.map((emp) => {
                                                const rec = attendanceByUidAndDate.get(`${emp.uid}|${selectedDate}`)!;
                                                const statusResult = calculateAttendanceStatus(
                                                    rec.checkIn!, rec.checkOut, selectedDate, settings
                                                );
                                                const token = STATUS_COLORS[statusResult.status];

                                                return (
                                                    <tr key={emp.uid} className="hover:bg-surface-50 transition-colors">
                                                        {/* Employee */}
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-3">
                                                                {/* Avatar */}
                                                                <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-bold">
                                                                    {emp.avatar
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        ? <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                                                                        : emp.name.split(' ').pop()?.[0]?.toUpperCase()
                                                                    }
                                                                </div>
                                                                <div>
                                                                    <button
                                                                        onClick={() => setPopupEmployee(emp)}
                                                                        className="font-semibold text-surface-800 hover:text-primary-700 hover:underline transition-colors text-left"
                                                                    >
                                                                        {emp.name}
                                                                    </button>
                                                                    <p className="text-xs text-surface-400">{emp.phone}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Status badge */}
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={cn(
                                                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold',
                                                                token.bg, token.text
                                                            )}>
                                                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: token.hex }} />
                                                                {token.label}
                                                            </span>
                                                        </td>

                                                        {/* Actual punch-in */}
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={cn('font-bold text-sm', token.text)}>
                                                                {formatTime(rec.checkIn)}
                                                            </span>
                                                        </td>

                                                        {/* Effective check-in (capped) */}
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="text-surface-600 text-sm font-mono">
                                                                {statusResult.status === 'EARLY'
                                                                    ? formatTime(statusResult.effectiveCheckIn)
                                                                    : formatTime(rec.checkIn)}
                                                            </span>
                                                        </td>

                                                        {/* Check-out */}
                                                        <td className="px-4 py-3 text-center">
                                                            {rec.checkOut ? (
                                                                <span className="text-sm font-bold text-primary-700">
                                                                    {formatTime(rec.checkOut)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">1 lần quét</span>
                                                            )}
                                                        </td>

                                                        {/* Working hours */}
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="text-sm font-bold text-surface-700">
                                                                {statusResult.workHours != null
                                                                    ? `${statusResult.workHours}h`
                                                                    : '—'}
                                                            </span>
                                                        </td>

                                                        {/* Punch count */}
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={cn(
                                                                'px-2 py-1 rounded-lg text-xs font-bold',
                                                                rec.punchCount > 2 ? 'bg-amber-50 text-amber-700' : 'bg-surface-100 text-surface-600'
                                                            )}>
                                                                {rec.punchCount} lần
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer summary */}
                            {!fetchingCalc && dayFilteredEmployees.length > 0 && (
                                <div className="px-5 py-3 bg-surface-50 border-t border-surface-100 flex items-center gap-6 text-xs text-surface-500">
                                    <span><strong className="text-success-600">{dayFilteredEmployees.length}</strong> nhân viên có chấm công</span>
                                    <span><strong className="text-surface-500">{mappedEmployees.length - dayFilteredEmployees.length}</strong> không có dữ liệu hôm nay</span>
                                    <span className="ml-auto">
                                        {['EARLY','ON_TIME','LATE'].map((s) => {
                                            const count = dayFilteredEmployees.filter((e) => {
                                                const rec = attendanceByUidAndDate.get(`${e.uid}|${selectedDate}`);
                                                return rec && getStatus(rec.checkIn, rec.checkOut, selectedDate) === s;
                                            }).length;
                                            if (!count) return null;
                                            const t = STATUS_COLORS[s as PunchStatus];
                                            return (
                                                <span key={s} className={cn('mr-3', t.text)}>
                                                    {t.label}: <strong>{count}</strong>
                                                </span>
                                            );
                                        })}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MONTH MODE GRID */}
                    {dateMode === 'month' && (
                        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-surface-100">
                                <p className="text-sm font-semibold text-surface-700">
                                    Tháng {selectedMonth} · {filteredEmployees.length} nhân viên
                                </p>
                            </div>

                            {fetchingCalc ? (
                                <div className="py-20 flex justify-center">
                                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="text-xs border-collapse min-w-max">
                                        <thead>
                                            <tr className="bg-surface-50 border-b border-surface-200">
                                                <th className="sticky left-0 z-10 bg-surface-50 px-4 py-3 text-left font-bold text-surface-500 uppercase tracking-wider min-w-[160px] border-r border-surface-200">
                                                    Nhân viên
                                                </th>
                                                {monthDays.map((d) => {
                                                    const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                                                    const dow = new Date(dateStr + 'T00:00').getDay();
                                                    const isWeekend = dow === 0 || dow === 6;
                                                    return (
                                                        <th key={d} className={cn(
                                                            'px-1.5 py-2 text-center font-bold w-14 min-w-[56px]',
                                                            isWeekend ? 'text-primary-500 bg-primary-50' : 'text-surface-500',
                                                            dateStr === todayDate() && 'bg-accent-50 text-accent-700'
                                                        )}>
                                                            <div>{d}</div>
                                                            <div className="font-normal text-[10px] opacity-70">
                                                                {['CN','T2','T3','T4','T5','T6','T7'][dow]}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100">
                                            {filteredEmployees.length === 0 ? (
                                                <tr><td colSpan={monthDays.length + 1} className="py-12 text-center text-surface-400">
                                                    Chưa có nhân viên nào được ghép.
                                                </td></tr>
                                            ) : (
                                                filteredEmployees.map((emp) => (
                                                    <tr key={emp.uid} className="hover:bg-surface-50 group">
                                                        <td className="sticky left-0 z-10 bg-white group-hover:bg-surface-50 px-3 py-2 border-r border-surface-200">
                                                            <div className="flex items-center gap-2 min-w-[160px]">
                                                                {/* Avatar */}
                                                                <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-[10px] font-bold">
                                                                    {emp.avatar
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        ? <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                                                                        : emp.name.split(' ').pop()?.[0]?.toUpperCase()
                                                                    }
                                                                </div>
                                                                <button
                                                                    onClick={() => setPopupEmployee(emp)}
                                                                    className="font-medium text-surface-800 hover:text-primary-700 hover:underline transition-colors text-left truncate max-w-[115px]"
                                                                >
                                                                    {emp.name}
                                                                </button>
                                                            </div>
                                                        </td>
                                                        {monthDays.map((d) => {
                                                            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                                                            const rec = attendanceByUidAndDate.get(`${emp.uid}|${dateStr}`);
                                                            const dow = new Date(dateStr + 'T00:00').getDay();
                                                            const isWeekend = dow === 0 || dow === 6;
                                                            const isToday = dateStr === todayDate();
                                                            let statusClass = '';
                                                            if (rec?.checkIn) {
                                                                const s = getStatus(rec.checkIn, rec.checkOut, dateStr);
                                                                statusClass = STATUS_COLORS[s].text;
                                                            }
                                                            return (
                                                                <td key={d} className={cn(
                                                                    'px-1 py-1.5 text-center align-middle border-l border-surface-50',
                                                                    isWeekend && 'bg-primary-50/30',
                                                                    isToday && 'bg-accent-50/40',
                                                                    rec && 'bg-green-50/30'
                                                                )}>
                                                                    {rec ? (
                                                                        <div className="flex flex-col items-center gap-0.5">
                                                                            <span className={cn('font-semibold leading-tight', statusClass)}>
                                                                                {formatTime(rec.checkIn)}
                                                                            </span>
                                                                            {rec.checkOut && (
                                                                                <span className="text-primary-600 leading-tight">
                                                                                    {formatTime(rec.checkOut)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-surface-200 select-none">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ════════════════════════════════════════════════════════════════
                TAB 2 — RAW PUNCH HISTORY (Day mode only)
            ════════════════════════════════════════════════════════════════ */}
            {dateMode === 'day' && innerTab === 'raw' && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-surface-100 flex items-center justify-between">
                        <p className="text-sm font-semibold text-surface-700">
                            Lịch sử chạm thẻ — {new Date(selectedDate + 'T00:00').toLocaleDateString('vi-VN', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                            })}
                        </p>
                        <button
                            onClick={fetchRawPunches}
                            disabled={fetchingRaw}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-surface-200 text-surface-600 hover:bg-surface-100 transition-all"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', fetchingRaw && 'animate-spin')} />
                            Làm mới
                        </button>
                    </div>

                    {fetchingRaw ? (
                        <div className="py-20 flex justify-center">
                            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : rawPunches.length === 0 ? (
                        <div className="py-16 text-center text-surface-400 text-sm">
                            Không có lần quét nào trong ngày này.
                        </div>
                    ) : (
                        <div className="divide-y divide-surface-100">
                            {rawPunches.map((group) => (
                                <div key={group.zk_user_id} className="flex items-start gap-4 px-5 py-4 hover:bg-surface-50 transition-colors">
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-surface-300 to-surface-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                        {group.zk_name.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <p className="font-semibold text-surface-800 text-sm">{group.zk_name}</p>
                                            {group.mapped_system_name && (
                                                <span className="text-[11px] bg-success-50 text-success-700 px-2 py-0.5 rounded-full font-medium">
                                                    → {group.mapped_system_name}
                                                </span>
                                            )}
                                            <code className="text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">
                                                {group.zk_user_id}
                                            </code>
                                            <span className="ml-auto text-[11px] text-surface-400">
                                                {group.timestamps.length} lần quét
                                            </span>
                                        </div>

                                        {/* Punch timeline */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {group.timestamps.map((ts, idx) => {
                                                const isFirst = idx === 0;
                                                const isLast = idx === group.timestamps.length - 1 && group.timestamps.length > 1;
                                                return (
                                                    <div key={ts} className="flex items-center gap-1">
                                                        <span className={cn(
                                                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border',
                                                            isFirst && 'bg-green-50 text-green-700 border-green-200',
                                                            isLast && 'bg-blue-50 text-blue-700 border-blue-200',
                                                            !isFirst && !isLast && 'bg-surface-50 text-surface-600 border-surface-200'
                                                        )}>
                                                            {formatTime(ts)}
                                                            {isFirst && <span className="text-[9px] opacity-60 ml-0.5">●IN</span>}
                                                            {isLast && <span className="text-[9px] opacity-60 ml-0.5">●OUT</span>}
                                                        </span>
                                                        {idx < group.timestamps.length - 1 && (
                                                            <ChevronRight className="w-3 h-3 text-surface-300 shrink-0" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Employee Profile Popup ────────────────────────────────────── */}
            {popupEmployee && (
                <EmployeeProfilePopup
                    employeeUid={popupEmployee.uid}
                    storeId={popupEmployee.storeId}
                    initialTab="attendance"
                    onClose={() => setPopupEmployee(null)}
                />
            )}

            {/* ════════════════════════════════════════════════════════════════
                ATTENDANCE RULES SLIDE-OVER PANEL
            ════════════════════════════════════════════════════════════════ */}

            {/* Backdrop */}
            {showRulesPanel && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                    onClick={() => setShowRulesPanel(false)}
                />
            )}

            {/* Slide-over */}
            <div className={cn(
                'fixed top-0 right-0 h-screen w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
                showRulesPanel ? 'translate-x-0' : 'translate-x-full'
            )}>
                {/* Panel header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                            <Settings2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-surface-800 text-base">Cài đặt Quy tắc Chấm công</h2>
                            <p className="text-xs text-surface-500">Lưu vào Firestore · Áp dụng ngay lập tức</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowRulesPanel(false)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto">

                    {/* Info banner */}
                    <div className="px-6 pt-5 pb-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
                            <strong>Cách hoạt động:</strong> Mỗi ca trong <code className="bg-amber-100 px-1 rounded">shiftTimes</code> có cài đặt riêng.
                            Khi nhân viên quẹt thẻ, hệ thống tự gán ca dựa trên startTime gần nhất.
                            Ư u tiên: ngày đặc biệt → cuối tuần → ngày thường.
                        </div>
                    </div>

                    {/* One section per shift */}
                    {shiftNames.map((shiftName) => {
                        const entry = shiftRules[shiftName];
                        const isOpen = expandedShift === shiftName;
                        if (!entry) return null;
                        return (
                            <div key={shiftName} className="border-t border-surface-100">
                                {/* Accordion header */}
                                <button
                                    onClick={() => setExpandedShift(isOpen ? null : shiftName)}
                                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                                            {shiftNames.indexOf(shiftName) + 1}
                                        </span>
                                        <div>
                                            <p className="font-semibold text-surface-800 text-sm">{shiftName}</p>
                                            <p className="text-xs text-surface-400">
                                                Ngày thường: {entry.weekday.startTime}–{entry.weekday.endTime}
                                                {' · '}
                                                Cuối tuần: {entry.weekend.startTime}–{entry.weekend.endTime}
                                            </p>
                                        </div>
                                    </div>
                                    {isOpen
                                        ? <ChevronUp className="w-4 h-4 text-surface-400 shrink-0" />
                                        : <ChevronDown className="w-4 h-4 text-surface-400 shrink-0" />}
                                </button>

                                {/* Accordion body */}
                                {isOpen && (
                                    <div className="px-6 pb-6 space-y-5">

                                        {/* Weekday */}
                                        <div>
                                            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">T2</span>
                                                Ca ngày thường (Thứ 2 – Thứ 6)
                                            </p>
                                            <div className="bg-surface-50 rounded-xl p-4 border border-surface-200">
                                                <RuleFields
                                                    rule={entry.weekday}
                                                    onChange={(f, v) => patchShiftRule(shiftName, 'weekday', f, v)}
                                                />
                                            </div>
                                        </div>

                                        {/* Weekend */}
                                        <div>
                                            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold">T7</span>
                                                Ca cuối tuần (Thứ 7, Chủ nhật)
                                            </p>
                                            <div className="bg-surface-50 rounded-xl p-4 border border-surface-200">
                                                <RuleFields
                                                    rule={entry.weekend}
                                                    onChange={(f, v) => patchShiftRule(shiftName, 'weekend', f, v)}
                                                />
                                            </div>
                                        </div>

                                        {/* Special dates */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                                                    <span className="w-5 h-5 rounded bg-rose-100 text-rose-700 flex items-center justify-center text-[10px]">★</span>
                                                    Ngày đặc biệt
                                                </p>
                                                <button
                                                    onClick={() => addSpecialDate(shiftName)}
                                                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-all"
                                                >
                                                    <Plus className="w-3 h-3" /> Thêm ngày
                                                </button>
                                            </div>

                                            {entry.specialDates.length === 0 ? (
                                                <p className="text-xs text-surface-400 text-center py-3">
                                                    Chưa có ngày ngoại lệ nào cho ca này.
                                                </p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {entry.specialDates.map(({ date, rule }, idx) => (
                                                        <div key={idx} className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <input
                                                                    type="date"
                                                                    value={date}
                                                                    onChange={(e) => setSpecialDate(shiftName, idx, e.target.value)}
                                                                    className="flex-1 px-3 py-1.5 text-sm border border-rose-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
                                                                />
                                                                <button
                                                                    onClick={() => removeSpecialDate(shiftName, idx)}
                                                                    className="w-7 h-7 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-100 transition-all shrink-0"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <RuleFields
                                                                rule={rule}
                                                                onChange={(f, v) => patchShiftSpecial(shiftName, idx, f, v)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Sticky save footer */}
                <div className="border-t border-surface-200 px-6 py-4 bg-white flex items-center gap-3">
                    <button
                        onClick={handleSaveRules}
                        disabled={savingRules}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all shadow-md',
                            rulesSaved
                                ? 'bg-green-500 text-white shadow-green-200'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-200 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60'
                        )}
                    >
                        {savingRules ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : rulesSaved ? (
                            <>✓ Đã lưu thành công!</>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Lưu cài đặt
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setShowRulesPanel(false)}
                        className="px-4 py-3 rounded-xl text-sm font-medium text-surface-600 border border-surface-200 hover:bg-surface-100 transition-all"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper sub-component: one rule form row
// ─────────────────────────────────────────────────────────────────────────────

function RuleFields({
    rule,
    onChange,
}: {
    rule: AttendanceRule;
    onChange: (field: keyof AttendanceRule, value: string | number) => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-3">
            <label className="block">
                <span className="text-xs font-medium text-surface-500 mb-1 block">Giờ vào (startTime)</span>
                <input
                    type="time"
                    value={rule.startTime}
                    onChange={(e) => onChange('startTime', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
            </label>
            <label className="block">
                <span className="text-xs font-medium text-surface-500 mb-1 block">Giờ ra (endTime)</span>
                <input
                    type="time"
                    value={rule.endTime}
                    onChange={(e) => onChange('endTime', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
            </label>
            <label className="block">
                <span className="text-xs font-medium text-surface-500 mb-1 block">Cho phép vào sớm (phút)</span>
                <input
                    type="number"
                    min={0}
                    max={120}
                    value={rule.allowedEarlyMins}
                    onChange={(e) => onChange('allowedEarlyMins', Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <span className="text-[10px] text-surface-400 mt-0.5 block">Vẫn tính On-Time nếu quẹt trước giờ này</span>
            </label>
            <label className="block">
                <span className="text-xs font-medium text-surface-500 mb-1 block">Cho phép vào trễ (phút)</span>
                <input
                    type="number"
                    min={0}
                    max={120}
                    value={rule.allowedLateMins}
                    onChange={(e) => onChange('allowedLateMins', Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <span className="text-[10px] text-surface-400 mt-0.5 block">Vẫn tính On-Time trong khoảng này</span>
            </label>
        </div>
    );
}
