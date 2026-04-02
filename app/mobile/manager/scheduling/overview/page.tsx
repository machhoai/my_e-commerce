'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { UserDoc, CounterDoc, ScheduleDoc, StoreDoc, SettingsDoc, CustomRoleDoc } from '@/types';
import { getWeekStart, toLocalDateString, shortName } from '@/lib/utils';
import { cn } from '@/lib/utils';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import BottomSheet from '@/components/shared/BottomSheet';
import {
    ChevronLeft, ChevronRight, Users, Clock, MapPin,
    UserCog, CalendarDays, Briefcase, Building2, Download, Loader2,
    Image as ImageIcon, FileText
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerVietnameseFont } from '@/lib/pdf-font';

type ViewMode = 'employee' | 'shift';

export default function MobileSchedulingOverviewPage() {
    const { user, userDoc, hasPermission, loading: authLoading, effectiveStoreId: contextStoreId } = useAuth();

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
    const [weekDays, setWeekDays] = useState<Date[]>([]);
    const [selectedDayIdx, setSelectedDayIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const [viewMode, setViewMode] = useState<ViewMode>('shift');
    const [selectedShift, setSelectedShift] = useState('');
    const [showOffDuty, setShowOffDuty] = useState(false);

    const [users, setUsers] = useState<UserDoc[]>([]);
    const [allUsersMap, setAllUsersMap] = useState<Map<string, UserDoc>>(new Map());
    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);
    const [customRolesMap, setCustomRolesMap] = useState<Map<string, string>>(new Map());

    // Admin store selector
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('globalSelectedStoreId') || '';
        return '';
    });
    const [storeSheetOpen, setStoreSheetOpen] = useState(false);
    const [exportSheetOpen, setExportSheetOpen] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) {
            localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
        }
    }, [selectedAdminStoreId]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch stores for admin
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [userDoc, user, getToken]);

    const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : (contextStoreId || userDoc?.storeId || '');
    const selectedStoreName = useMemo(() => {
        if (!selectedAdminStoreId) return 'Tất cả cửa hàng';
        const s = stores.find(s => s.id === selectedAdminStoreId);
        return s?.name ?? selectedAdminStoreId;
    }, [selectedAdminStoreId, stores]);

    function getAvailableDays(start: Date) {
        const days = [];
        for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
        return days;
    }

    useEffect(() => {
        const days = getAvailableDays(currentWeekStart);
        const todayStr = toLocalDateString(new Date());
        const idx = days.findIndex(d => toLocalDateString(d) === todayStr);
        setSelectedDayIdx(idx >= 0 ? idx : 0);
    }, [currentWeekStart]);

    // Load data
    useEffect(() => {
        if (!userDoc) return;
        const hasAccess = ['admin', 'store_manager', 'manager'].includes(userDoc.role) || hasPermission('page.scheduling.overview');
        if (!hasAccess) { setLoading(false); return; }

        async function loadData() {
            setLoading(true);
            try {
                let usersQuery = query(collection(db, 'users'));
                if (effectiveStoreId) usersQuery = query(collection(db, 'users'), where('storeId', '==', effectiveStoreId));
                const usersSnap = await getDocs(usersQuery);
                const fullMap = new Map<string, UserDoc>();
                usersSnap.docs.forEach(d => { const u = d.data() as UserDoc; fullMap.set(u.uid, u); });
                setAllUsersMap(fullMap);
                setUsers(Array.from(fullMap.values()).filter(u => u.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name)));

                if (effectiveStoreId) {
                    const storeSnap = await getDoc(doc(db, 'stores', effectiveStoreId));
                    if (storeSnap.exists()) {
                        const storeData = storeSnap.data() as StoreDoc;
                        const storeSettings = storeData.settings as SettingsDoc;
                        setCounters((storeSettings as any)?.counters || []);
                        if (storeSettings) {
                            setSettings(storeSettings);
                            if (!selectedShift && storeSettings.shiftTimes?.length) setSelectedShift(storeSettings.shiftTimes[0]);
                        }
                    } else { setCounters([]); }
                } else { setCounters([]); }

                const days = getAvailableDays(currentWeekStart);
                setWeekDays(days);
                const schedulesSnap = await getDocs(
                    query(collection(db, 'schedules'), where('date', '>=', toLocalDateString(days[0])), where('date', '<=', toLocalDateString(days[6])))
                );
                setSchedules(schedulesSnap.docs.map(d => d.data() as ScheduleDoc));

                // Load custom roles for role name resolution
                const rolesSnap = await getDocs(collection(db, 'custom_roles'));
                const rolesMap = new Map<string, string>();
                rolesSnap.docs.forEach(d => { const r = d.data() as CustomRoleDoc; rolesMap.set(d.id, r.name); });
                setCustomRolesMap(rolesMap);
            } catch (err) { console.error('Failed to load overview data:', err); }
            finally { setLoading(false); }
        }
        loadData();
    }, [currentWeekStart, userDoc, effectiveStoreId]);

    // Access guard
    if (!userDoc || (userDoc.role !== 'admin' && userDoc.role !== 'store_manager' && userDoc.role !== 'manager' && !hasPermission('page.scheduling.overview'))) {
        return <MobilePageShell title="Lịch tổng quan"><div className="p-8 text-center text-red-500 font-bold">Không có quyền truy cập.</div></MobilePageShell>;
    }

    const shifts: string[] = settings?.shiftTimes ?? ['Sáng', 'Chiều', 'Tối'];
    const selectedDate = weekDays[selectedDayIdx];
    const selectedDateStr = selectedDate ? toLocalDateString(selectedDate) : '';
    const isToday = (d: Date) => toLocalDateString(d) === toLocalDateString(new Date());
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const formatDateDisplay = (date: Date) => date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

    const previousWeek = () => { const d = new Date(currentWeekStart); d.setDate(d.getDate() - 7); setCurrentWeekStart(d); };
    const nextWeek = () => { const d = new Date(currentWeekStart); d.setDate(d.getDate() + 7); setCurrentWeekStart(d); };

    const getScheduleCell = (userId: string, dateStr: string, shiftId: string) => {
        const s = schedules.find(s => s.date === dateStr && s.shiftId === shiftId && s.employeeIds?.includes(userId));
        if (s) { const c = counters.find(c => c.id === s.counterId); return { counterName: c?.name ?? 'Đã phân', isForceAssigned: s.assignedByManagerUids?.includes(userId) ?? false }; }
        return null;
    };

    // Day stats with role breakdown (by customRoleId)
    const dayStats = useMemo(() => {
        type ShiftStat = { name: string; count: number; roles: Map<string, number> };
        if (!selectedDateStr) return { total: 0, roles: new Map<string, number>(), shifts: [] as ShiftStat[] };
        const getRoleLabel = (u: UserDoc) => u.customRoleId ? (customRolesMap.get(u.customRoleId) || 'NV') : u.role === 'store_manager' ? 'CTH' : u.role === 'manager' ? 'QL' : 'NV';
        const shiftStats: ShiftStat[] = shifts.map(shift => {
            const uids = new Set<string>();
            counters.forEach(c => { const s = schedules.find(s => s.date === selectedDateStr && s.shiftId === shift && s.counterId === c.id); s?.employeeIds?.forEach(uid => uids.add(uid)); });
            const roles = new Map<string, number>();
            uids.forEach(uid => { const u = users.find(u => u.uid === uid); if (u) { const label = getRoleLabel(u); roles.set(label, (roles.get(label) || 0) + 1); } });
            return { name: shift, count: uids.size, roles };
        });
        const totalUids = new Set<string>();
        shiftStats.forEach(ss => { counters.forEach(c => { const s = schedules.find(s => s.date === selectedDateStr && s.shiftId === ss.name && s.counterId === c.id); s?.employeeIds?.forEach(uid => totalUids.add(uid)); }); });
        const totalRoles = new Map<string, number>();
        totalUids.forEach(uid => { const u = users.find(u => u.uid === uid); if (u) { const label = getRoleLabel(u); totalRoles.set(label, (totalRoles.get(label) || 0) + 1); } });
        return { total: totalUids.size, roles: totalRoles, shifts: shiftStats };
    }, [selectedDateStr, schedules, counters, shifts, users, customRolesMap]);

    const weekId = weekDays.length > 0 ? `${formatDateDisplay(weekDays[0])}-${formatDateDisplay(weekDays[6])}` : 'unknown';

    // ═══════════════════ EXPORT LOGIC ═══════════════════

    const tagColorMap: Record<string, string> = { '[FT]': '#2563eb', '[PT]': '#059669', '[QL]': '#d97706', '[CTH]': '#dc2626' };
    const tagRgbMap: Record<string, [number, number, number]> = { '[FT]': [37, 99, 235], '[PT]': [5, 150, 105], '[QL]': [217, 119, 6], '[CTH]': [220, 38, 38] };

    const buildShiftExportData = () => {
        const dn = ['CN', 'TH 2', 'TH 3', 'TH 4', 'TH 5', 'TH 6', 'TH 7'];
        const headerRow1Days = weekDays.map(date => `${dn[date.getDay()]} (${formatDateDisplay(date)})`);
        const headerRow2Shifts = weekDays.flatMap(() => shifts.map(s => s));
        const bodyRows: string[][] = [];
        counters.forEach(c => {
            const row: string[] = [c.name];
            weekDays.forEach(date => {
                const dateStr = toLocalDateString(date);
                shifts.forEach(shiftName => {
                    const cellSchedule = schedules.find(s => s.date === dateStr && s.shiftId === shiftName && s.counterId === c.id);
                    if (cellSchedule?.employeeIds?.length) {
                        row.push(cellSchedule.employeeIds.map(uid => { const u = users.find(usr => usr.uid === uid); if (!u) return null; const tag = u.role === 'store_manager' ? '[CTH]' : u.role === 'manager' ? '[QL]' : u.type === 'FT' ? '[FT]' : '[PT]'; return `${tag}${shortName(u.name)}`; }).filter(Boolean).join('\n') || '-');
                    } else { row.push('-'); }
                });
            });
            bodyRows.push(row);
        });
        const summaryRow: string[] = ['Tổng'];
        weekDays.forEach(date => {
            const dateStr = toLocalDateString(date);
            shifts.forEach(shiftName => {
                const uids = new Set<string>();
                counters.forEach(c => { const s = schedules.find(s => s.date === dateStr && s.shiftId === shiftName && s.counterId === c.id); s?.employeeIds?.forEach(uid => uids.add(uid)); });
                const roleCounts = new Map<string, number>();
                uids.forEach(uid => { const u = users.find(u => u.uid === uid); const label = u?.customRoleId ? (customRolesMap.get(u.customRoleId) || 'NV') : u?.role === 'store_manager' ? 'CTH' : u?.role === 'manager' ? 'QL' : 'NV'; roleCounts.set(label, (roleCounts.get(label) || 0) + 1); });
                const parts: string[] = [];
                roleCounts.forEach((count, label) => parts.push(`${count} ${label}`));
                summaryRow.push(parts.length > 0 ? parts.join(', ') : '—');
            });
        });
        return { headerRow1Days, headerRow2Shifts, bodyRows, summaryRow };
    };

    const buildEmployeeExportMatrix = () => {
        const dn = ['CN', 'TH 2', 'TH 3', 'TH 4', 'TH 5', 'TH 6', 'TH 7'];
        const header = ['Nhân sự \\ Ngày', ...weekDays.map(date => `${dn[date.getDay()]} (${formatDateDisplay(date)})`)];
        const body: string[][] = [];
        users.forEach(u => {
            const tag = u.role === 'store_manager' ? '[CTH]' : u.role === 'manager' ? '[QL]' : u.type === 'FT' ? '[FT]' : '[PT]';
            const row: string[] = [`${tag}${shortName(u.name)}`];
            weekDays.forEach(date => {
                const dateStr = toLocalDateString(date);
                row.push(shifts.map(sn => { const r = getScheduleCell(u.uid, dateStr, sn); return r ? `${sn}: ${r.counterName}` : null; }).filter(Boolean).join('\n') || '- Nghỉ -');
            });
            body.push(row);
        });
        return { header, body };
    };

    const cellToHtml = (cell: string) => cell.split('\n').map(line => {
        const match = line.match(/^\[(FT|PT|QL|CTH)\](.*)$/);
        if (match) return `<span style="color:${tagColorMap[`[${match[1]}]`] || '#334155'};font-weight:600">${match[2]}</span>`;
        return `<span>${line}</span>`;
    }).join('<br/>');

    const exportAsPDF = async () => {
        setIsExporting(true); setExportSheetOpen(false);
        try {
            const d = new jsPDF('landscape', 'mm', 'a4');
            await registerVietnameseFont(d);
            d.setFontSize(14); d.text(`Lịch Tổng Quan Tuần: ${weekId}`, 14, 15);
            const stripTags = (t: string) => t.replace(/\[(FT|PT|QL|CTH)\]/g, '');
            const getTagRgb = (t: string): [number, number, number] | null => { const m = t.match(/^\[(FT|PT|QL|CTH)\]/); return m ? tagRgbMap[`[${m[1]}]`] || null : null; };

            if (viewMode === 'shift') {
                const { headerRow1Days, headerRow2Shifts, bodyRows, summaryRow } = buildShiftExportData();
                const sc = shifts.length;
                const h1: any[] = [{ content: 'Quầy \\ Ngày', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }];
                headerRow1Days.forEach(dl => h1.push({ content: dl, colSpan: sc, styles: { halign: 'center' } }));
                const h2: any[] = headerRow2Shifts.map(s => ({ content: s, styles: { halign: 'center' } }));
                autoTable(d, {
                    head: [h1, h2], body: [...bodyRows.map(r => r.map(c => stripTags(c))), summaryRow.map(c => stripTags(c))], startY: 22, theme: 'grid',
                    styles: { font: 'Roboto', fontSize: 6, halign: 'center', valign: 'middle', cellPadding: 1.5, lineWidth: 0.2, lineColor: [200, 200, 200] },
                    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 7 },
                    alternateRowStyles: { fillColor: [245, 247, 255] }, columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 28 }, ...Object.fromEntries(Array.from({ length: shifts.length * 7 }, (_, i) => [i + 1, { cellWidth: 32 }])) },
                    didParseCell: (data: any) => { if (data.section === 'body') { if (data.row.index === bodyRows.length) { data.cell.styles.fillColor = [224, 231, 255]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [67, 56, 202]; } else if (data.column.index > 0) { const raw = bodyRows[data.row.index]?.[data.column.index]; if (raw) { const rgb = getTagRgb(raw); if (rgb) data.cell.styles.textColor = rgb; } } } },
                });
            } else {
                const { header, body } = buildEmployeeExportMatrix();
                autoTable(d, {
                    head: [header], body: body.map(r => r.map(c => stripTags(c))), startY: 22, theme: 'grid',
                    styles: { font: 'Roboto', fontSize: 7, halign: 'center', valign: 'middle', cellPadding: 2, lineWidth: 0.2, lineColor: [200, 200, 200] },
                    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                    alternateRowStyles: { fillColor: [245, 247, 255] }, columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 }, ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { cellWidth: 32 }])) },
                    didParseCell: (data: any) => { if (data.section === 'body' && data.column.index === 0) { const raw = body[data.row.index]?.[0]; if (raw) { const rgb = getTagRgb(raw); if (rgb) data.cell.styles.textColor = rgb; } } },
                });
            }
            d.save(`Lich-Tong-Quan-Tuan-${weekId}.pdf`);
        } catch (err) { console.error('Export PDF failed:', err); }
        finally { setIsExporting(false); }
    };

    const exportAsImage = async () => {
        setIsExporting(true); setExportSheetOpen(false);
        try {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:fixed;top:-99999px;left:0;z-index:-1;background:#fff;padding:24px;width:2000px;';
            const titleEl = document.createElement('h2');
            titleEl.textContent = `Lịch Tổng Quan Tuần: ${weekId}`;
            titleEl.style.cssText = 'font-family:Arial,sans-serif;font-size:18px;font-weight:bold;margin:0 0 12px 0;color:#1e293b;';
            wrapper.appendChild(titleEl);
            const table = document.createElement('table');
            table.style.cssText = 'border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;width:auto;';
            const thStyle = 'border:1px solid #c7d2fe;padding:8px 12px;background:#6366f1;color:#fff;font-weight:bold;text-align:center;white-space:nowrap;';

            if (viewMode === 'shift') {
                const { headerRow1Days, headerRow2Shifts, bodyRows, summaryRow } = buildShiftExportData();
                const sc = shifts.length;
                const thead = document.createElement('thead');
                const tr1 = document.createElement('tr');
                const thLabel = document.createElement('th'); thLabel.textContent = 'Quầy \\ Ngày'; thLabel.rowSpan = 2; thLabel.style.cssText = thStyle; tr1.appendChild(thLabel);
                headerRow1Days.forEach(dl => { const th = document.createElement('th'); th.textContent = dl; th.colSpan = sc; th.style.cssText = thStyle; tr1.appendChild(th); });
                thead.appendChild(tr1);
                const tr2 = document.createElement('tr');
                headerRow2Shifts.forEach(sl => { const th = document.createElement('th'); th.textContent = sl; th.style.cssText = 'border:1px solid #c7d2fe;padding:6px 10px;background:#818cf8;color:#fff;font-weight:600;text-align:center;white-space:nowrap;font-size:11px;width:120px;min-width:120px;'; tr2.appendChild(th); });
                thead.appendChild(tr2); table.appendChild(thead);
                const tbody = document.createElement('tbody');
                bodyRows.forEach(row => { const tr = document.createElement('tr'); row.forEach((cell, ci) => { const td = document.createElement('td'); td.style.cssText = `border:1px solid #e2e8f0;padding:6px 10px;text-align:center;vertical-align:middle;line-height:1.5;${ci === 0 ? 'text-align:left;font-weight:600;background:#f8fafc;white-space:nowrap;' : 'width:120px;min-width:120px;'}`; if (ci === 0) td.textContent = cell; else td.innerHTML = cellToHtml(cell); tr.appendChild(td); }); tbody.appendChild(tr); });
                const trS = document.createElement('tr'); summaryRow.forEach((cell, ci) => { const td = document.createElement('td'); td.style.cssText = `border:1px solid #c7d2fe;padding:6px 10px;text-align:center;vertical-align:middle;line-height:1.5;background:#e0e7ff;font-weight:bold;color:#4338ca;${ci === 0 ? 'text-align:left;white-space:nowrap;' : 'width:120px;min-width:120px;'}`; td.textContent = cell; trS.appendChild(td); }); tbody.appendChild(trS);
                table.appendChild(tbody);
            } else {
                const { header, body } = buildEmployeeExportMatrix();
                const thead = document.createElement('thead'); const hr = document.createElement('tr');
                header.forEach(h => { const th = document.createElement('th'); th.textContent = h; th.style.cssText = thStyle; hr.appendChild(th); });
                thead.appendChild(hr); table.appendChild(thead);
                const tbody = document.createElement('tbody');
                body.forEach((row, ri) => { const tr = document.createElement('tr'); tr.style.cssText = ri % 2 === 0 ? 'background:#fff;' : 'background:#f5f7ff;'; row.forEach((cell, ci) => { const td = document.createElement('td'); td.style.cssText = `border:1px solid #e2e8f0;padding:6px 10px;text-align:center;vertical-align:middle;white-space:pre-line;line-height:1.5;${ci === 0 ? 'text-align:left;font-weight:600;background:#f8fafc;white-space:nowrap;' : 'width:120px;min-width:120px;'}`; if (ci === 0) td.innerHTML = cellToHtml(cell); else td.textContent = cell; tr.appendChild(td); }); tbody.appendChild(tr); });
                table.appendChild(tbody);
            }
            wrapper.appendChild(table);
            document.body.appendChild(wrapper);
            await new Promise(r => setTimeout(r, 50));
            const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            document.body.removeChild(wrapper);
            const link = document.createElement('a'); link.download = `Lich-Tong-Quan-Tuan-${weekId}.png`; link.href = canvas.toDataURL('image/png'); link.click();
        } catch (err) { console.error('Export image failed:', err); }
        finally { setIsExporting(false); }
    };

    // ═══════════════════ RENDER ═══════════════════

    return (
        <MobilePageShell
            title="Lịch tổng quan"
            headerRight={
                <button onClick={() => setExportSheetOpen(true)} disabled={isExporting || loading}
                    className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-transform">
                    {isExporting ? <Loader2 className="w-4 h-4 text-gray-500 animate-spin" /> : <Download className="w-4 h-4 text-gray-600" />}
                </button>
            }
        >
            {/* ── Admin store selector ─────────────────────────────────────── */}
            {userDoc?.role === 'admin' && (
                <button onClick={() => setStoreSheetOpen(true)}
                    className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-3 mb-3 active:scale-[0.98] transition-all">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cửa hàng</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{selectedStoreName}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
            )}

            {/* ── Week nav + Day tabs (combined compact row) ───────────────── */}
            <div className="flex items-center gap-1 mb-3">
                <button onClick={previousWeek} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shadow-sm shrink-0">
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-hide">
                    {weekDays.map((date, idx) => {
                        const today = isToday(date);
                        const selected = idx === selectedDayIdx;
                        return (
                            <button key={idx} onClick={() => setSelectedDayIdx(idx)}
                                className={cn(
                                    'flex flex-1 flex-col items-center min-w-[40px] py-1.5 px-1 rounded-xl transition-all',
                                    selected ? 'bg-primary-600 text-white shadow-md shadow-primary-200' : today ? 'bg-primary-50 text-primary-700' : 'bg-white text-gray-500'
                                )}>
                                <span className={cn('text-[9px] font-bold', selected ? 'text-primary-200' : 'text-gray-400')}>{dayNames[date.getDay()]}</span>
                                <span className="text-sm font-black leading-tight">{date.getDate()}</span>
                            </button>
                        );
                    })}
                </div>
                <button onClick={nextWeek} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shadow-sm shrink-0">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
            </div>

            {/* ── Day stats (role-based breakdown) ───────────────────────── */}
            {!loading && selectedDate && (
                <div className="mb-3 space-y-1.5">
                    {/* Total row with role pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <div className="bg-gray-800 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                            <Users className="w-3 h-3" />
                            <span className="text-[10px] font-black">{dayStats.total}</span>
                        </div>
                        {Array.from(dayStats.roles.entries()).map(([label, count]) => {
                            const bgColor = label === 'CTH' ? 'bg-red-500' : label === 'QL' ? 'bg-amber-500' : 'bg-primary-500';
                            return <span key={label} className={cn(bgColor, 'text-white px-2 py-1 rounded-lg text-[10px] font-bold shrink-0')}>{count} {label}</span>;
                        })}
                    </div>
                    {/* Per-shift breakdown */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        {dayStats.shifts.map(ss => (
                            <div key={ss.name} className="bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-semibold text-gray-500">{ss.name}</span>
                                <span className="text-[10px] font-black text-gray-800">{ss.count}</span>
                                {Array.from(ss.roles.entries()).map(([label, count]) => {
                                    const color = label === 'CTH' ? 'text-red-600' : label === 'QL' ? 'text-amber-600' : 'text-primary-600';
                                    return <span key={label} className={cn('text-[9px] font-bold', color)}>{count}{label}</span>;
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── View mode toggle + shift selector ───────────────────────── */}
            <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg flex-1">
                    <button onClick={() => setViewMode('shift')}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-bold transition-all',
                            viewMode === 'shift' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500')}>
                        <Briefcase className="w-3 h-3" /> Quầy
                    </button>
                    <button onClick={() => setViewMode('employee')}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-bold transition-all',
                            viewMode === 'employee' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500')}>
                        <Users className="w-3 h-3" /> NV
                    </button>
                </div>
                {viewMode === 'shift' && (
                    <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)}
                        className="bg-white border border-gray-200 text-xs font-bold text-gray-700 rounded-lg px-3 py-2 outline-none">
                        {shifts.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                )}
            </div>

            {/* ── Content ─────────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    <p className="text-xs text-gray-400 mt-3 font-medium">Đang tải...</p>
                </div>
            ) : viewMode === 'shift' ? (
                <div className="space-y-2">
                    {counters.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                            <MapPin className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                            <p className="text-xs text-gray-400 font-medium">Chưa cấu hình quầy.</p>
                        </div>
                    ) : counters.map(counter => {
                        const cellSchedule = schedules.find(s => s.date === selectedDateStr && s.shiftId === selectedShift && s.counterId === counter.id);
                        const assignedUsers: (UserDoc & { isForced: boolean })[] = [];
                        cellSchedule?.employeeIds?.forEach(uid => { const u = allUsersMap.get(uid); if (u) assignedUsers.push({ ...u, isForced: cellSchedule.assignedByManagerUids?.includes(uid) ?? false }); });

                        return (
                            <div key={counter.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-3.5 h-3.5 text-primary-500" />
                                        <span className="text-xs font-bold text-gray-800">{counter.name}</span>
                                    </div>
                                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', assignedUsers.length > 0 ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-400')}>
                                        {assignedUsers.length}
                                    </span>
                                </div>
                                {assignedUsers.length === 0 ? (
                                    <p className="text-[10px] text-gray-300 italic text-center py-2">Trống</p>
                                ) : (
                                    <div className="px-3 py-2 flex flex-wrap gap-1.5">
                                        {assignedUsers.map(u => {
                                            const color = u.role === 'store_manager' ? 'text-red-600' : u.role === 'manager' ? 'text-amber-600' : u.type === 'FT' ? 'text-blue-600' : 'text-emerald-600';
                                            return (
                                                <span key={u.uid} className={cn(
                                                    'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border',
                                                    u.isForced ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'
                                                )}>
                                                    <span className={color}>{shortName(u.name)}</span>
                                                    {u.isForced && <UserCog className="w-2.5 h-2.5 text-amber-500" />}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-0.5">
                    {/* Toggle off-duty */}
                    {users.length > 0 && (
                        <button onClick={() => setShowOffDuty(!showOffDuty)}
                            className="text-[10px] font-semibold text-primary-500 mb-2 flex items-center gap-1">
                            {showOffDuty ? 'Ẩn nhân viên nghỉ' : 'Hiện nhân viên nghỉ'}
                        </button>
                    )}
                    {users.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                            <Users className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                            <p className="text-xs text-gray-400 font-medium">Chưa có nhân sự.</p>
                        </div>
                    ) : users.map(u => {
                        const dayAssignments = shifts.map(sn => { const r = getScheduleCell(u.uid, selectedDateStr, sn); return r ? { shiftName: sn, ...r } : null; }).filter(Boolean) as { shiftName: string; counterName: string; isForceAssigned: boolean }[];
                        if (!showOffDuty && dayAssignments.length === 0) return null;
                        const color = u.role === 'store_manager' ? 'text-red-600' : u.role === 'manager' ? 'text-amber-600' : u.type === 'FT' ? 'text-blue-600' : 'text-emerald-600';
                        const tag = u.role === 'store_manager' ? 'CTH' : u.role === 'manager' ? 'QL' : u.type;

                        return (
                            <div key={u.uid} className={cn('flex items-center gap-2.5 px-3 py-2 bg-white border-b border-gray-50', dayAssignments.length === 0 && 'opacity-40')}>
                                <span className={cn('text-[9px] font-black w-7 text-center shrink-0', color)}>{tag}</span>
                                <span className="text-xs font-semibold text-gray-800 truncate min-w-[70px]">{shortName(u.name)}</span>
                                <div className="flex-1 flex flex-wrap gap-1 justify-end">
                                    {dayAssignments.length > 0 ? dayAssignments.map(a => (
                                        <span key={a.shiftName} className={cn(
                                            'text-[10px] font-semibold px-2 py-0.5 rounded-md border',
                                            a.isForceAssigned ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-primary-50 text-primary-600 border-primary-100'
                                        )}>
                                            {a.shiftName}·{a.counterName}
                                        </span>
                                    )) : <span className="text-[10px] text-gray-300 italic">Nghỉ</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Export BottomSheet ───────────────────────────────────────── */}
            <BottomSheet isOpen={exportSheetOpen} onClose={() => setExportSheetOpen(false)} title="Xuất lịch tuần">
                <div className="flex flex-col gap-2 p-4 pb-6">
                    <p className="text-xs text-gray-500 mb-1">Xuất toàn bộ lịch tuần {weekId}</p>
                    <button onClick={exportAsImage} disabled={isExporting}
                        className="flex items-center gap-3 px-4 py-3.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-semibold text-sm active:scale-[0.98] transition-all">
                        <ImageIcon className="w-5 h-5" /> Xuất ảnh PNG
                    </button>
                    <button onClick={exportAsPDF} disabled={isExporting}
                        className="flex items-center gap-3 px-4 py-3.5 bg-primary-50 text-primary-700 rounded-xl border border-primary-200 font-semibold text-sm active:scale-[0.98] transition-all">
                        <FileText className="w-5 h-5" /> Xuất file PDF
                    </button>
                </div>
            </BottomSheet>

            {/* ── Store BottomSheet ────────────────────────────────────────── */}
            <BottomSheet isOpen={storeSheetOpen} onClose={() => setStoreSheetOpen(false)} title="Chọn cửa hàng">
                <div className="flex flex-col pb-6">
                    <button onClick={() => { setSelectedAdminStoreId(''); setStoreSheetOpen(false); }}
                        className={cn('flex items-center gap-3 px-5 py-3.5 text-left transition-colors', !selectedAdminStoreId ? 'bg-primary-50' : 'active:bg-gray-50')}>
                        <span className="text-lg">🌐</span>
                        <span className={cn('text-sm font-semibold flex-1', !selectedAdminStoreId ? 'text-primary-700' : 'text-gray-700')}>Tất cả cửa hàng</span>
                        {!selectedAdminStoreId && <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
                    </button>
                    {stores.map(s => (
                        <button key={s.id} onClick={() => { setSelectedAdminStoreId(s.id); setStoreSheetOpen(false); }}
                            className={cn('flex items-center gap-3 px-5 py-3 text-left transition-colors', selectedAdminStoreId === s.id ? 'bg-primary-50' : 'active:bg-gray-50')}>
                            <span className="text-lg">🏪</span>
                            <span className={cn('text-sm font-semibold flex-1 truncate', selectedAdminStoreId === s.id ? 'text-primary-700' : 'text-gray-700')}>{s.name}</span>
                            {selectedAdminStoreId === s.id && <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
                        </button>
                    ))}
                </div>
            </BottomSheet>
        </MobilePageShell>
    );
}
