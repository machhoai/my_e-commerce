'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc, orderBy, where } from 'firebase/firestore';
import { UserDoc, ScheduleDoc, CounterDoc, SettingsDoc, StoreDoc } from '@/types';
import { getWeekStart, toLocalDateString } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, Users, Clock, Store, Building2, UserCog, Image, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type ViewMode = 'employee' | 'shift';

export default function GlobalOverviewPage() {
    const { user, userDoc } = useAuth();
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
    const [weekDays, setWeekDays] = useState<Date[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const [viewMode, setViewMode] = useState<ViewMode>('shift');
    const [selectedShift, setSelectedShift] = useState<string>('');

    const [users, setUsers] = useState<UserDoc[]>([]);
    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);

    // Admin store selector
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('globalSelectedStoreId') || '';
        }
        return '';
    });

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) {
            localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
        }
    }, [selectedAdminStoreId]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch stores for admin once
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !user) return;
        async function fetchStores() {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        }
        fetchStores();
    }, [userDoc, user, getToken]);

    // Only Admin, Store Manager & Manager (with canManageHR) can access
    useEffect(() => {
        if (!userDoc || !['admin', 'store_manager', 'manager'].includes(userDoc.role)) return;

        // Admin: filter by selected store if chosen, otherwise show all
        const effectiveStoreId = userDoc.role === 'admin' ? selectedAdminStoreId : userDoc.storeId;

        async function loadData() {
            setLoading(true);
            try {
                // 1. Load users filtered by storeId
                let usersQuery = query(collection(db, 'users'));
                if (effectiveStoreId) {
                    usersQuery = query(collection(db, 'users'), where('storeId', '==', effectiveStoreId));
                }
                const usersSnap = await getDocs(usersQuery);
                const allUsers = usersSnap.docs.map(d => d.data() as UserDoc)
                    .filter(u => u.role !== 'admin' && u.isActive !== false)
                    .sort((a, b) => a.name.localeCompare(b.name));
                setUsers(allUsers);

                // 2. Load store settings (shiftTimes, counters, etc.)
                if (effectiveStoreId) {
                    const storeSnap = await getDoc(doc(db, 'stores', effectiveStoreId));
                    if (storeSnap.exists()) {
                        const storeData = storeSnap.data() as StoreDoc;
                        const storeSettings = storeData.settings as SettingsDoc;

                        // Extract counters from store settings
                        const countersData = (storeSettings as any)?.counters || [];
                        setCounters(countersData);

                        if (storeSettings) {
                            setSettings(storeSettings);
                            if (!selectedShift && storeSettings.shiftTimes && storeSettings.shiftTimes.length > 0) {
                                setSelectedShift(storeSettings.shiftTimes[0]);
                            }
                        }
                    } else {
                        setCounters([]);
                    }
                } else {
                    setCounters([]);
                }

                // 4. Load schedules for the week, filtered by storeId
                const days = getAvailableDays(currentWeekStart);
                setWeekDays(days);
                const minDate = toLocalDateString(days[0]);
                const maxDate = toLocalDateString(days[6]);

                const schedulesQuery = query(
                    collection(db, 'schedules'),
                    where('date', '>=', minDate),
                    where('date', '<=', maxDate)
                );

                const schedulesSnap = await getDocs(schedulesQuery);

                // We fetch all schedules for the week. Since we already filtered users
                // and counters by storeId, we don't strictly need to filter schedules.
                // The UI will only show schedules that match the rendered users/counters.
                const weekScheds = schedulesSnap.docs.map(d => d.data() as ScheduleDoc);
                setSchedules(weekScheds);

            } catch (err) {
                console.error("Failed to load overview data:", err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [currentWeekStart, userDoc, selectedAdminStoreId]);

    if (!userDoc || (userDoc.role !== 'admin' && userDoc.role !== 'store_manager' && userDoc.role !== 'manager' && userDoc.canManageHR !== true)) {
        return <div className="p-8 text-center text-red-500 font-bold">Không có quyền truy cập.</div>;
    }


    const previousWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() - 7);
        setCurrentWeekStart(d);
    };

    const nextWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + 7);
        setCurrentWeekStart(d);
    };

    // Helper to find schedule
    const getScheduleCell = (userId: string, dateStr: string, shiftId: string) => {
        // Find if this user is assigned to any counter in this shift
        const userSchedule = schedules.find(s => s.date === dateStr && s.shiftId === shiftId && s.employeeIds?.includes(userId));
        if (userSchedule) {
            const counterObj = counters.find(counter => counter.id === userSchedule.counterId);
            const isForceAssigned = userSchedule.assignedByManagerUids?.includes(userId) ?? false;
            return {
                counterName: counterObj ? counterObj.name : 'Đã phân',
                isForceAssigned,
            };
        }
        return null;
    };


    const shifts: string[] = settings?.shiftTimes ?? ['Sáng', 'Chiều', 'Tối'];


    const formatDateDisplay = (date: Date) => {
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    function getAvailableDays(start: Date) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    }

    // Week ID for export filenames
    const weekId = weekDays.length > 0
        ? `${formatDateDisplay(weekDays[0])}-${formatDateDisplay(weekDays[6])}`
        : 'unknown';

    // ============ DATA-DRIVEN EXPORT ============

    /** Build a 2D matrix from current schedule data */
    const buildExportMatrix = (): { header: string[]; body: string[][] } => {
        const dayNames = ['CN', 'TH 2', 'TH 3', 'TH 4', 'TH 5', 'TH 6', 'TH 7'];

        // Header row
        const header = [
            viewMode === 'shift' ? `Quầy \\ Ngày (Ca: ${selectedShift})` : 'Nhân sự \\ Ngày',
            ...weekDays.map(date => {
                const dayLabel = dayNames[date.getDay()];
                return `${dayLabel} (${formatDateDisplay(date)})`;
            })
        ];

        const body: string[][] = [];

        if (viewMode === 'shift') {
            // Shift view: rows = counters, cells = employees assigned to that counter+shift+day
            counters.forEach(c => {
                const row: string[] = [c.name];
                weekDays.forEach(date => {
                    const dateStr = toLocalDateString(date);
                    const cellSchedule = schedules.find(
                        s => s.date === dateStr && s.shiftId === selectedShift && s.counterId === c.id
                    );
                    if (cellSchedule?.employeeIds?.length) {
                        const names = cellSchedule.employeeIds
                            .map(uid => {
                                const u = users.find(usr => usr.uid === uid);
                                if (!u) return null;
                                const role = u.role === 'manager' ? 'QL' : u.type;
                                return `${u.name} (${role})`;
                            })
                            .filter(Boolean)
                            .join('\n');
                        row.push(names || '- Trống -');
                    } else {
                        row.push('- Trống -');
                    }
                });
                body.push(row);
            });
        } else {
            // Employee view: rows = users, cells = shift+counter assignments for that day
            users.forEach(u => {
                const roleLabel = u.role === 'manager' ? 'QL' : u.type;
                const row: string[] = [`${u.name} (${roleLabel})`];
                weekDays.forEach(date => {
                    const dateStr = toLocalDateString(date);
                    const dayAssignments = shifts
                        .map(shiftName => {
                            const result = getScheduleCell(u.uid, dateStr, shiftName);
                            if (result) return `${shiftName}: ${result.counterName}`;
                            return null;
                        })
                        .filter(Boolean)
                        .join('\n');
                    row.push(dayAssignments || '- Nghỉ -');
                });
                body.push(row);
            });
        }

        return { header, body };
    };

    /** Export as PDF using jspdf-autotable */
    const exportAsPDF = async () => {
        setIsExporting(true);
        try {
            const { header, body } = buildExportMatrix();
            const doc = new jsPDF('landscape', 'mm', 'a4');

            // Title
            doc.setFontSize(14);
            doc.text(`Lich Tong Quan Tuan: ${weekId} Ca: ${selectedShift}`, 14, 15);

            autoTable(doc, {
                head: [header],
                body: body,
                startY: 22,
                theme: 'grid',
                styles: {
                    fontSize: 7,
                    halign: 'center',
                    valign: 'middle',
                    cellPadding: 2,
                    lineWidth: 0.2,
                    lineColor: [200, 200, 200],
                },
                headStyles: {
                    fillColor: [99, 102, 241],
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 8,
                },
                alternateRowStyles: {
                    fillColor: [245, 247, 255],
                },
                columnStyles: {
                    0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 },
                },
            });

            doc.save(`Lich-Tong-Quan-Tuan-${weekId}-${selectedShift}.pdf`);
        } catch (err) {
            console.error('Export PDF failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    /** Export as PNG using a hidden clean HTML table + html2canvas */
    const exportAsImage = async () => {
        setIsExporting(true);
        try {
            const { header, body } = buildExportMatrix();

            // Create a clean, hidden HTML table with inline styles (no Tailwind)
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:fixed;top:-99999px;left:0;z-index:-1;background:#fff;padding:24px;';

            // Title
            const title = document.createElement('h2');
            title.textContent = `Lịch Tổng Quan Tuần: ${weekId} Ca: ${selectedShift}`;
            title.style.cssText = 'font-family:Arial,sans-serif;font-size:18px;font-weight:bold;margin:0 0 12px 0;color:#1e293b;';
            wrapper.appendChild(title);

            const table = document.createElement('table');
            table.style.cssText = 'border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;width:auto;';

            // Header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            header.forEach(h => {
                const th = document.createElement('th');
                th.textContent = h;
                th.style.cssText = 'border:1px solid #c7d2fe;padding:8px 12px;background:#6366f1;color:#fff;font-weight:bold;text-align:center;white-space:nowrap;';
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Body
            const tbody = document.createElement('tbody');
            body.forEach((row, rowIdx) => {
                const tr = document.createElement('tr');
                tr.style.cssText = rowIdx % 2 === 0 ? 'background:#fff;' : 'background:#f5f7ff;';
                row.forEach((cell, colIdx) => {
                    const td = document.createElement('td');
                    td.style.cssText = `border:1px solid #e2e8f0;padding:6px 10px;text-align:center;vertical-align:middle;white-space:pre-line;line-height:1.5;${colIdx === 0 ? 'text-align:left;font-weight:600;background:#f8fafc;white-space:nowrap;' : ''
                        }`;
                    td.textContent = cell;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            wrapper.appendChild(table);

            document.body.appendChild(wrapper);

            // Wait for reflow then capture
            await new Promise(r => setTimeout(r, 50));

            const canvas = await html2canvas(wrapper, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });

            // Cleanup
            document.body.removeChild(wrapper);

            const link = document.createElement('a');
            link.download = `Lich-Tong-Quan-Tuan-${weekId}-${selectedShift}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Export image failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-4 mx-auto">
            {/* Admin Store Selector Banner */}
            {userDoc?.role === 'admin' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-700">Cửa hàng:</span>
                    </div>
                    <select
                        value={selectedAdminStoreId}
                        onChange={e => setSelectedAdminStoreId(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 font-medium"
                    >
                        <option value="">-- Tất cả cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Main content */}
            {(() => {
                const isAdmin = userDoc?.role === 'admin';
                const storeMap = new Map(stores.map(s => [s.id, s.name]));
                return (
                    <>
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar className="w-7 h-7 text-indigo-600" />
                                    Lịch tổng quan toàn hệ thống
                                </h1>
                                <p className="text-slate-500 mt-1">
                                    Xem chi tiết lịch làm việc và phân công vị trí của tất cả nhân viên.
                                </p>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                            {/* View Toggles */}
                            <div className="flex w-full items-center gap-2 p-1 bg-slate-100 rounded-lg shrink-0">
                                <button
                                    onClick={() => setViewMode('employee')}
                                    className={cn(
                                        "flex items-center justify-center flex-1 truncate gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all",
                                        viewMode === 'employee' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    <Users className="w-4 h-4" />
                                    Tất cả nhân viên
                                </button>
                                <button
                                    onClick={() => setViewMode('shift')}
                                    className={cn(
                                        "flex items-center justify-center flex-1 truncate gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all",
                                        viewMode === 'shift' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    <Clock className="w-4 h-4" />
                                    Theo Lịch Ca
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-full overflow-x-hidden pb-1 md:pb-0">
                            {/* Week Selector */}
                            <div className="flex flex-1 items-center gap-1.5 shrink-0 w-full">
                                <button onClick={previousWeek} className="p-2.5 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-sm bg-white" title="Tuần trước">
                                    <ChevronLeft className="size-5 text-slate-600" />
                                </button>
                                <div className="font-bold text-slate-800 text-sm min-w-[170px] flex-1 text-center bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-inner">
                                    {weekDays.length > 0 && `${formatDateDisplay(weekDays[0])} - ${formatDateDisplay(weekDays[6])}`}
                                </div>
                                <button onClick={nextWeek} className="p-2.5 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-sm bg-white" title="Tuần sau">
                                    <ChevronRight className="size-5 text-slate-600" />
                                </button>
                            </div>

                            <div className="flex flex-col flex-1 sm:flex-none md:flex-row items-center justify-between w-full sm:w-fit gap-2">
                                {/* Shift Selector (Only visible in Shift Mode) */}
                                {viewMode === 'shift' && (
                                    <div className="w-full sm:w-fit flex flex-1 items-center gap-2 md:mr-2 bg-white">
                                        <select
                                            value={selectedShift}
                                            onChange={(e) => setSelectedShift(e.target.value)}
                                            className="bg-white w-full sm:w-fit border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none font-medium h-[42px]"
                                        >
                                            {shifts.map(shift => (
                                                <option key={shift} value={shift}>{shift}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Export Buttons */}
                                <div className="flex items-center gap-2 shrink-0 w-full">
                                    <button
                                        onClick={exportAsImage}
                                        disabled={isExporting || loading}
                                        className={cn(
                                            "flex items-center flex-1 sm:flex-none gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all shadow-sm",
                                            isExporting || loading
                                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 active:scale-95"
                                        )}
                                        title="Xuất ảnh PNG"
                                    >
                                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                                        <span className="inline">Xuất Ảnh</span>
                                    </button>
                                    <button
                                        onClick={exportAsPDF}
                                        disabled={isExporting || loading}
                                        className={cn(
                                            "flex items-center flex-1 sm:flex-none gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all shadow-sm",
                                            isExporting || loading
                                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 active:scale-95"
                                        )}
                                        title="Xuất file PDF"
                                    >
                                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                        <span className="inline">Xuất PDF</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                {loading ? (
                                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                        Đang tải dữ liệu...
                                    </div>
                                ) : (
                                    viewMode === 'employee' ? (
                                        <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
                                            <thead className="text-xs text-slate-500 bg-slate-50/80">
                                                <tr>
                                                    <th className="p-4 border-b border-r border-slate-200 font-bold text-slate-700 sticky left-0 bg-slate-50/90 backdrop-blur-sm z-10 w-48 shadow-[1px_0_0_0_#e2e8f0]">
                                                        Nhân sự \ Ngày
                                                    </th>
                                                    {weekDays.map((date, i) => {
                                                        const isToday = toLocalDateString(new Date()) === toLocalDateString(date);
                                                        return (
                                                            <th key={i} className={cn(
                                                                "p-3 border-b border-x border-slate-200 font-semibold text-center min-w-[140px]",
                                                                isToday ? 'bg-indigo-50/50 text-indigo-700' : ''
                                                            )}>
                                                                <div className="text-xs uppercase opacity-70 mb-0.5">
                                                                    {date.toLocaleDateString('vi-VN', { weekday: 'short' })}
                                                                </div>
                                                                <div className="text-sm">
                                                                    {formatDateDisplay(date)}
                                                                </div>
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.map((u, userIdx) => (
                                                    <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors group">
                                                        {/* User Cell - Sticky */}
                                                        <td className={cn(
                                                            "p-4 border-b border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 shadow-[1px_0_0_0_#e2e8f0]",
                                                            userIdx === users.length - 1 ? 'border-b-0' : ''
                                                        )}>
                                                            <div className="font-semibold text-slate-800 truncate" title={u.name}>{u.name}</div>
                                                            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold flex-wrap">
                                                                <span className={cn(
                                                                    'px-1.5 py-0.5 rounded uppercase',
                                                                    u.type === 'FT' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                                )}>
                                                                    {u.type}
                                                                </span>
                                                                <span className={cn(
                                                                    'px-1.5 py-0.5 rounded capitalize',
                                                                    u.role === 'manager' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                                                                )}>
                                                                    {u.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                                                                </span>
                                                                {isAdmin && u.storeId && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                                                                        {storeMap.get(u.storeId) ?? u.storeId}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {weekDays.map((date, dayIdx) => {
                                                            const dateStr = toLocalDateString(date);
                                                            const isToday = toLocalDateString(new Date()) === dateStr;

                                                            const dayAssignments = shifts.map((shiftName: string) => {
                                                                const result = getScheduleCell(u.uid, dateStr, shiftName);
                                                                if (result) {
                                                                    return { shiftName, assignedCounter: result.counterName, isForceAssigned: result.isForceAssigned };
                                                                }
                                                                return null;
                                                            }).filter((item: any) => item !== null) as { shiftName: string, assignedCounter: string, isForceAssigned: boolean }[];

                                                            return (
                                                                <td key={dayIdx} className={cn(
                                                                    "p-2 border-b border-x border-slate-100 align-top",
                                                                    isToday ? 'bg-indigo-50/20' : ''
                                                                )}>
                                                                    <div className="space-y-1.5 flex flex-col h-full justify-start items-center relative">
                                                                        {dayAssignments.length > 0 ? (
                                                                            dayAssignments.map(({ shiftName, assignedCounter, isForceAssigned }) => (
                                                                                <div key={shiftName} className={`text-[11px] w-full p-2 rounded-lg border shadow-sm leading-normal flex flex-col transition-all ${isForceAssigned
                                                                                    ? 'bg-amber-50 border-amber-100 hover:bg-amber-100'
                                                                                    : 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100'
                                                                                    }`}>
                                                                                    <div className="flex items-center gap-1 mb-0.5">
                                                                                        <span className={`font-semibold ${isForceAssigned ? 'text-amber-700' : 'text-indigo-700'}`}>{shiftName}</span>
                                                                                        {isForceAssigned && (
                                                                                            <span title="Quản lý gán ca"><UserCog className="w-3 h-3 text-amber-500" /></span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className={`flex items-center gap-1 font-medium bg-white px-1.5 py-0.5 rounded shadow-sm border ${isForceAssigned ? 'text-amber-700 border-amber-100' : 'text-slate-600 border-slate-100'}`}>
                                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isForceAssigned ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                                                                                        <span className="truncate">{assignedCounter}</span>
                                                                                    </span>
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <div className="text-[11px] p-2 text-slate-400 font-medium italic text-center w-full h-full flex items-center justify-center min-h-[50px] rounded border border-transparent">
                                                                                - Nghỉ -
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {users.length === 0 && !loading && (
                                                    <tr>
                                                        <td colSpan={8} className="p-8 text-center text-slate-500">
                                                            Chưa có dữ liệu nhân sự.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
                                            <thead className="text-xs text-slate-500 bg-slate-50/80">
                                                <tr>
                                                    <th className="p-4 border-b border-r border-slate-200 font-bold text-slate-700 text-center sticky left-0 bg-slate-50/90 backdrop-blur-sm z-10 w-48 shadow-[1px_0_0_0_#e2e8f0]">
                                                        Quầy \ Ngày
                                                    </th>
                                                    {weekDays.map((date, i) => {
                                                        const isToday = toLocalDateString(new Date()) === toLocalDateString(date);
                                                        return (
                                                            <th key={i} className={cn(
                                                                "p-3 border-b border-x border-slate-200 font-semibold text-center min-w-[140px]",
                                                                isToday ? 'bg-indigo-50/50 text-indigo-700' : ''
                                                            )}>
                                                                <div className="text-xs uppercase opacity-70 mb-0.5">
                                                                    {date.toLocaleDateString('vi-VN', { weekday: 'short' })}
                                                                </div>
                                                                <div className="text-sm">
                                                                    {formatDateDisplay(date)}
                                                                </div>
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {counters.map((c, idx) => (
                                                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        {/* Counter Cell - Sticky */}
                                                        <td className={cn(
                                                            "p-2 border-b border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#e2e8f0]",
                                                            idx === counters.length - 1 ? 'border-b-0' : ''
                                                        )}>
                                                            <div className="font-semibold flex flex-col text-center text-slate-800 truncate items-center gap-2">
                                                                {c.name}
                                                            </div>
                                                        </td>

                                                        {/* Days Cells */}
                                                        {weekDays.map((date, dayIdx) => {
                                                            const dateStr = toLocalDateString(date);
                                                            const isToday = toLocalDateString(new Date()) === dateStr;

                                                            // Lấy danh sách nhân viên được xếp vào Quầy c, Ca selectedShift, Ngày dateStr
                                                            const assignedUsersForCell: UserDoc[] = [];
                                                            const cellSchedule = schedules.find(s => s.date === dateStr && s.shiftId === selectedShift && s.counterId === c.id);

                                                            if (cellSchedule && cellSchedule.employeeIds) {
                                                                cellSchedule.employeeIds.forEach(uid => {
                                                                    const userObj = users.find(u => u.uid === uid);
                                                                    if (userObj) assignedUsersForCell.push(userObj);
                                                                });
                                                            }

                                                            return (
                                                                <td key={dayIdx} className={cn(
                                                                    "p-0 border-b border-x border-slate-100 align-top",
                                                                    isToday ? 'bg-indigo-50/20' : ''
                                                                )}>
                                                                    <div className="space-y-1.5 flex flex-col h-full justify-start items-center relative">
                                                                        {assignedUsersForCell.length > 0 ? (
                                                                            assignedUsersForCell.map(u => {
                                                                                const isUserForceAssigned = cellSchedule?.assignedByManagerUids?.includes(u.uid) ?? false;
                                                                                return (
                                                                                    <div key={u.uid} className={`text-[12px] w-full p-2 py-1.5 rounded border shadow-sm flex flex-col transition-all ${isUserForceAssigned
                                                                                        ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                                                                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                                                                        }`}>
                                                                                        <div className="flex items-center gap-1">
                                                                                            <span className={`font-semibold truncate ${isUserForceAssigned ? 'text-amber-800' : 'text-slate-800'}`} title={u.name}>{u.name}</span>
                                                                                            {isUserForceAssigned && (
                                                                                                <span title="Quản lý gán ca"><UserCog className="w-3 h-3 text-amber-500 shrink-0" /></span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 mt-0.5 text-[9px] font-bold">
                                                                                            <span className={cn(
                                                                                                'px-1 py-0.5 pb-1 rounded uppercase leading-relaxed',
                                                                                                u.type === 'FT' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                                                            )}>
                                                                                                {u.type}
                                                                                            </span>
                                                                                            {u.role === 'manager' && (
                                                                                                <span className="px-1 py-0.5 pb-1 rounded capitalize leading-relaxed bg-amber-50 text-amber-600">
                                                                                                    QL
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <div className="text-[11px] p-2 text-slate-400 font-medium italic text-center w-full h-full flex items-center justify-center min-h-[40px] rounded border border-transparent">
                                                                                - Trống -
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {counters.length === 0 && !loading && (
                                                    <tr>
                                                        <td colSpan={8} className="p-8 text-center text-slate-500">
                                                            Chưa cấu hình Quầy/Vị trí.
                                                        </td>
                                                    </tr>
                                                )}
                                                {/* Summary row: total employees per day for selectedShift */}
                                                {counters.length > 0 && (
                                                    <tr className="bg-indigo-50/60 border-t-2 border-indigo-200">
                                                        <td className="p-4 border-r border-indigo-200 sticky left-0 bg-indigo-50 z-10 shadow-[1px_0_0_0_#c7d2fe]">
                                                            <div className="font-bold text-indigo-700 flex flex-col text-center items-center gap-2 text-sm">
                                                                <Users className="w-4 h-4" />
                                                                Tổng
                                                            </div>
                                                            <div className="text-[13px] text-center text-indigo-500 mt-0.5">{selectedShift}</div>
                                                        </td>
                                                        {weekDays.map((date, dayIdx) => {
                                                            const dateStr = toLocalDateString(date);
                                                            const isToday = toLocalDateString(new Date()) === dateStr;

                                                            // Collect unique UIDs across all counters for this shift & day
                                                            const uniqueUids = new Set<string>();
                                                            counters.forEach(c => {
                                                                const cellSchedule = schedules.find(s =>
                                                                    s.date === dateStr &&
                                                                    s.shiftId === selectedShift &&
                                                                    s.counterId === c.id
                                                                );
                                                                cellSchedule?.employeeIds?.forEach(uid => uniqueUids.add(uid));
                                                            });

                                                            // Split by role
                                                            let managerCount = 0;
                                                            let employeeCount = 0;
                                                            uniqueUids.forEach(uid => {
                                                                const u = users.find(u => u.uid === uid);
                                                                if (u?.role === 'manager' || u?.role === 'store_manager') managerCount++;
                                                                else employeeCount++;
                                                            });
                                                            const total = uniqueUids.size;

                                                            return (
                                                                <td key={dayIdx} className={cn(
                                                                    "p-3 border-x border-indigo-100 text-center",
                                                                    isToday ? 'bg-indigo-100/60' : ''
                                                                )}>
                                                                    {total > 0 ? (
                                                                        <div className="flex flex-col items-center gap-1.5">
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-sm" title="Tổng nhân viên">
                                                                                <Users className="w-3 h-3" />
                                                                                {employeeCount} NV
                                                                            </span>
                                                                            {managerCount > 0 && (
                                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-sm" title="Quản lý">
                                                                                    <Users className="w-3 h-3" />
                                                                                    {managerCount} QL
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-400 text-xs font-medium">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )
                                )}
                            </div>
                        </div>
                    </>
                );
            })()}
        </div>
    );
}
