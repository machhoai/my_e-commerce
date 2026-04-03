'use client';

/**
 * DailyReportClient.tsx
 * ─────────────────────────────────────────────────────────────
 * Component client chính cho trang "Daily Report Panel".
 * Sử dụng Framer Motion cho animation, Recharts cho biểu đồ.
 *
 * Date navigation: dùng URL search param ?date=YYYY-MM-DD.
 * Khi user chọn ngày mới → router.push() → server re-fetch.
 *
 * Props:
 *  - dailyPanel : Dữ liệu DailyPanel từ server
 *  - forDate    : Ngày đang hiển thị (YYYY-MM-DD)
 *  - today      : Ngày hôm nay (YYYY-MM-DD, VN timezone)
 *  - updatedAt  : ISO string thời điểm cập nhật
 *  - fromCache  : Dữ liệu từ cache hay trực tiếp
 *  - error      : Lỗi nếu có
 *  - isMobile   : Flag để điều chỉnh layout
 */

import React, { useMemo, useCallback, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import type { DailyPanel, GoodsTypeStats } from '@/app/desktop/(dashboard)/office/revenue/actions';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import AIAssistantChat from '@/components/admin/daily-report/AIAssistantChat';

// ─────────────────────────────────────────────────────────────
// Types & Props
// ─────────────────────────────────────────────────────────────
interface DailyReportClientProps {
    dailyPanel: DailyPanel | null;
    forDate: string;
    today: string;           // max date for the date picker
    updatedAt: string | null;
    fromCache: boolean;
    error?: string;
    isMobile?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Format số thành chuỗi VND rút gọn */
function fmtVND(amount: number): string {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} tỷ`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}tr`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`;
    return amount.toLocaleString('vi-VN');
}

/** Format số thành chuỗi VND đầy đủ */
function fmtVNDFull(amount: number): string {
    return amount.toLocaleString('vi-VN') + ' đ';
}

/** Format ngày YYYY-MM-DD → thứ X, DD/MM/YYYY */
function fmtDate(dateStr: string): string {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const d = new Date(dateStr + 'T00:00:00+07:00');
    return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Format datetime ISO → "HH:mm" */
function fmtTime(iso: string | null): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Trả về ngày trước/sau: direction = -1 (hôm qua) hoặc +1 (ngày mai) */
function shiftDate(dateStr: string, direction: -1 | 1): string {
    const d = new Date(dateStr + 'T00:00:00+07:00');
    d.setDate(d.getDate() + direction);
    // Format lại YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────────
// Goods Category Mapping
// ─────────────────────────────────────────────────────────────
const MEMBERSHIP_KEYWORDS = ["Top up thẻ"];
const TICKET_KEYWORDS = ["Vé một lượt", "Combo", "Vé 1 lượt", "VinHomes", "Quy đổi eVoucher"];
const SOUVENIR_KEYWORDS = ["HÀNG BÁN"];

function classifyGoodsType(name: string): 'membership' | 'ticket' | 'souvenir' | 'other' {
    const lower = name.toLowerCase();
    if (MEMBERSHIP_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) return 'membership';
    if (TICKET_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) return 'ticket';
    if (SOUVENIR_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) return 'souvenir';
    return 'other';
}

// ─────────────────────────────────────────────────────────────
// Mock hourly data generator (24h)
// ─────────────────────────────────────────────────────────────
function generateHourlyMock(totalOrders: number): { hour: string; orders: number }[] {
    const weights = [
        0, 0, 0, 0, 0, 0.1, 0.5, 1.5, 3, 5.5, 8, 9,
        8.5, 6.5, 5, 7, 9, 9.5, 8, 6, 5, 3.5, 2, 1,
    ];
    const total = weights.reduce((a, b) => a + b, 0);
    return weights.map((w, i) => ({
        hour: `${String(i).padStart(2, '0')}:00`,
        orders: Math.round((w / total) * totalOrders),
    }));
}

// ─────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────
const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
    }),
};

// ─────────────────────────────────────────────────────────────
// DateNavigator — thanh chọn ngày gọn đẹp
// ─────────────────────────────────────────────────────────────
function DateNavigator({
    forDate,
    today,
    onNavigate,
    isPending,
}: {
    forDate: string;
    today: string;
    onNavigate: (date: string) => void;
    isPending: boolean;
}) {
    const isToday = forDate === today;
    const prevDate = shiftDate(forDate, -1);
    const nextDate = shiftDate(forDate, 1);
    const canGoNext = nextDate <= today;

    return (
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1">
            {/* Nút ngày hôm qua */}
            <button
                onClick={() => onNavigate(prevDate)}
                disabled={isPending}
                title="Ngày hôm qua"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-white disabled:opacity-40 transition-all"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Date input — click vào hiện native calendar */}
            <div className="relative flex items-center gap-1.5">
                {isPending && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-700/80 rounded-lg z-10">
                        <div className="w-3.5 h-3.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <input
                    type="date"
                    value={forDate}
                    max={today}
                    onChange={e => { if (e.target.value) onNavigate(e.target.value); }}
                    disabled={isPending}
                    className="w-[130px] text-xs font-semibold text-center text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-600 border-0 rounded-lg px-2 py-1.5 outline-none cursor-pointer shadow-sm appearance-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-60 transition-all"
                />
            </div>

            {/* Nút ngày mai */}
            <button
                onClick={() => onNavigate(nextDate)}
                disabled={!canGoNext || isPending}
                title={canGoNext ? 'Ngày hôm sau' : 'Không thể xem ngày tương lai'}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 transition-all"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Nút "Hôm nay" — chỉ hiện khi không phải hôm nay */}
            <AnimatePresence>
                {!isToday && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => onNavigate(today)}
                        disabled={isPending}
                        className="ml-0.5 text-[11px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                        Hôm nay
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Metric Card lớn cho Section 1 */
function BigMetricCard({
    label, value, sub, icon, gradient, index,
}: {
    label: string; value: string; sub?: string;
    icon: React.ReactNode; gradient: string; index: number;
}) {
    return (
        <motion.div
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.02, translateY: -4 }}
            className={`relative overflow-hidden rounded-2xl p-5 ${gradient} shadow-lg cursor-default select-none`}
        >
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">{label}</span>
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">{icon}</div>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
                {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
            </div>
        </motion.div>
    );
}

/** Small Metric Card cho Section 3 */
function SmallMetricCard({
    label, value, icon, color, index,
}: {
    label: string; value: string | number; icon: React.ReactNode; color: string; index: number;
}) {
    return (
        <motion.div
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.03, translateY: -3 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md border border-slate-100 dark:border-slate-700 cursor-default"
        >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>{icon}</div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
        </motion.div>
    );
}

/** Section Header */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
    );
}

/** Goods Category Column */
function GoodsCategoryColumn({
    title, icon, color, accent, stats, totalRevenue, index,
}: {
    title: string; icon: React.ReactNode; color: string; accent: string;
    stats: GoodsTypeStats[]; totalRevenue: number; index: number;
}) {
    const groupQty = stats.reduce((sum, g) => sum + g.totalRealQty, 0);
    const groupRevenue = stats.reduce((sum, g) => sum + g.totalRealMoney, 0);
    const allItems = stats.flatMap(g => g.goodsItems);
    const topItems = [...allItems].sort((a, b) => b.realMoney - a.realMoney).slice(0, 6);
    const maxItemRevenue = topItems[0]?.realMoney || 1;

    return (
        <motion.div
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-md border border-slate-100 dark:border-slate-700 flex flex-col"
        >
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>{icon}</div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">{title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{groupQty} sản phẩm · {fmtVND(groupRevenue)}</p>
                </div>
            </div>

            {totalRevenue > 0 && (
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Tỷ trọng doanh thu</span>
                        <span className="font-semibold">{((groupRevenue / totalRevenue) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (groupRevenue / totalRevenue) * 100)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 + index * 0.1 }}
                            className={`h-full rounded-full ${accent}`}
                        />
                    </div>
                </div>
            )}

            <div className="space-y-2.5 flex-1">
                {topItems.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Không có dữ liệu</p>
                ) : (
                    topItems.map((item, i) => (
                        <div key={`${item.goodsId}-${i}`}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[60%]" title={item.goodsName}>{item.goodsName}</span>
                                <span className="text-slate-500 dark:text-slate-400 ml-2 shrink-0">{item.realQty} · {fmtVND(item.realMoney)}</span>
                            </div>
                            <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(item.realMoney / maxItemRevenue) * 100}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.4 + i * 0.05 }}
                                    className={`h-full rounded-full ${accent} opacity-70`}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Tổng cộng</span>
                <span className="font-bold text-slate-800 dark:text-white">{fmtVNDFull(groupRevenue)}</span>
            </div>
        </motion.div>
    );
}

/** Custom Tooltip cho AreaChart */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HourlyTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-white/10">
            <p className="font-semibold text-slate-300 mb-1">{label}</p>
            <p className="text-teal-400 font-bold">{payload[0].value} đơn</p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function DailyReportClient({
    dailyPanel,
    forDate,
    today,
    updatedAt,
    fromCache,
    error,
    isMobile = false,
}: DailyReportClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Điều hướng sang ngày mới — dùng startTransition để giữ UI responsive
    const handleNavigate = useCallback((date: string) => {
        startTransition(() => {
            const basePath = isMobile ? '/admin/daily-report' : '/admin/daily-report';
            router.push(`${basePath}?date=${date}`);
        });
    }, [router, isMobile]);

    const { shopSummary, paymentStats, goodsTypeStats, memberStats } = dailyPanel ?? {
        shopSummary: null, paymentStats: [], goodsTypeStats: [], memberStats: null,
    };

    useEffect(() => {
        console.log(memberStats);
    }, [memberStats]);

    // ── Section 1: Doanh thu ─────────────────────────────────────
    const cashStat = paymentStats.find(p =>
        p.paymentCategoryName?.toLowerCase().includes('tiền mặt') ||
        p.paymentCategoryName?.toLowerCase().includes('cash') ||
        p.paymentCategory === 1
    );
    const transferStat = paymentStats.find(p =>
        p.paymentCategoryName?.toLowerCase().includes('chuyển khoản') ||
        p.paymentCategoryName?.toLowerCase().includes('transfer') ||
        p.paymentCategory === 2
    );
    const totalRevenue = shopSummary?.shopRealMoney ?? 0;
    const totalOrders = paymentStats.reduce((sum, p) => sum + p.totalRealQty, 0);

    // ── Section 2: Nhóm hàng hóa ─────────────────────────────────
    const groupedGoods = useMemo(() => {
        return goodsTypeStats.reduce(
            (acc, g) => {
                const cat = classifyGoodsType(g.goodsTypeName);
                if (cat === 'membership') acc.membership.push(g);
                else if (cat === 'ticket') acc.ticket.push(g);
                else acc.souvenir.push(g);
                return acc;
            },
            { membership: [] as GoodsTypeStats[], ticket: [] as GoodsTypeStats[], souvenir: [] as GoodsTypeStats[] }
        );
    }, [goodsTypeStats]);

    // ── Section 4: Hành vi tiêu dùng ─────────────────────────────
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const avgOrdersPerHour = (totalOrders / 24).toFixed(1);
    const hourlyData = useMemo(() => generateHourlyMock(totalOrders || 300), [totalOrders]);

    // ── Section 3: Thành viên ──────────────────────────────────

    const isToday = forDate === today;

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 ${isMobile ? 'pb-8' : ''}`}>

            {/* ── Header ── */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <>
                        {/* Title + badges */}
                        <div className="flex items-center gap-2 flex-wrap justify-between w-full">
                            <div className="flex items-center gap-2">
                                <h1 className={`font-bold text-slate-800 dark:text-white ${isMobile ? 'text-base' : 'text-xl'}`}>
                                    📊 Daily Report
                                </h1>
                                <AnimatePresence>
                                    {!isToday && (
                                        <motion.span
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            className="text-[11px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 px-2 py-0.5 rounded-full"
                                        >
                                            Lịch sử
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                {fromCache && (
                                    <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 px-2.5 py-1 rounded-full font-medium">
                                        Cache
                                    </span>
                                )}
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isPending
                                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                    : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400'
                                    }`}>
                                    {isPending ? 'Đang tải...' : isToday ? 'Live' : 'Snapshot'}
                                </span>
                            </div>
                            <DateNavigator
                                forDate={forDate}
                                today={today}
                                onNavigate={handleNavigate}
                                isPending={isPending}
                            />
                        </div>

                        {/* Date subtitle + navigator */}
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {fmtDate(forDate)}
                                {!isToday && <span className="text-slate-400"> · Không phải hôm nay</span>}
                                {updatedAt && ` · Cập nhật ${fmtTime(updatedAt)}`}
                            </p>
                        </div>

                        {/* Loading bar */}
                        <AnimatePresence>
                            {isPending && (
                                <motion.div
                                    initial={{ scaleX: 0, originX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400 to-emerald-500"
                                />
                            )}
                        </AnimatePresence>
                    </>
                }
            />

            <div className={`${isMobile ? 'px-4 py-4' : 'px-0 py-6'} space-y-4`}>

                {/* ── Error State ── */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm"
                    >
                        <span className="font-semibold">⚠️ Lỗi:</span> {error}
                        <br />
                        <span className="text-xs text-red-500">Kiểm tra kết nối với hệ thống Joyworld.</span>
                    </motion.div>
                )}

                {/* Overlay mờ khi đang transition sang ngày mới */}
                <AnimatePresence>
                    {isPending && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-white/30 dark:bg-slate-900/30 backdrop-blur-[1px] z-10 pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                {/* ═══════════════════════════════════════════════════════
                    SECTION 1 — Bức tranh Doanh Thu
                ═══════════════════════════════════════════════════════ */}
                <section>
                    <SectionHeader
                        title="💰 Bức tranh Doanh Thu"
                        subtitle="Tổng hợp doanh thu thực tế trong ngày"
                    />
                    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        <BigMetricCard
                            index={0}
                            label="Tổng doanh thu thực"
                            value={fmtVND(totalRevenue)}
                            sub={`${totalOrders} đơn hàng · Hoàn ${fmtVND(shopSummary?.refundMoney ?? 0)}`}
                            gradient="bg-gradient-to-br from-teal-500 to-emerald-600"
                            icon={
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                        <BigMetricCard
                            index={1}
                            label="Doanh thu chuyển khoản"
                            value={fmtVND(transferStat?.totalRealMoney ?? 0)}
                            sub={`${transferStat?.totalRealQty ?? 0} đơn · ${transferStat?.sellRatioDisplay ?? '0%'} tổng`}
                            gradient="bg-gradient-to-br from-violet-500 to-purple-700"
                            icon={
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                            }
                        />
                        <BigMetricCard
                            index={2}
                            label="Doanh thu tiền mặt"
                            value={fmtVND(cashStat?.totalRealMoney ?? 0)}
                            sub={`${cashStat?.totalRealQty ?? 0} đơn · ${cashStat?.sellRatioDisplay ?? '0%'} tổng`}
                            gradient="bg-gradient-to-br from-amber-400 to-orange-500"
                            icon={
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            }
                        />
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════
                    SECTION 2 — Phân tích Hàng hóa
                ═══════════════════════════════════════════════════════ */}
                <section>
                    <SectionHeader
                        title="🛍️ Phân tích Hàng hóa"
                        subtitle="Chi tiết doanh thu theo nhóm sản phẩm"
                    />
                    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        <GoodsCategoryColumn index={3} title="Gói Thành Viên"
                            icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                            color="bg-gradient-to-br from-indigo-500 to-purple-600"
                            accent="bg-gradient-to-r from-indigo-500 to-purple-500"
                            stats={groupedGoods.membership} totalRevenue={totalRevenue}
                        />
                        <GoodsCategoryColumn index={4} title="Vé Vui Chơi"
                            icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>}
                            color="bg-gradient-to-br from-amber-400 to-orange-500"
                            accent="bg-gradient-to-r from-amber-400 to-orange-500"
                            stats={groupedGoods.ticket} totalRevenue={totalRevenue}
                        />
                        <GoodsCategoryColumn index={5} title="Hàng Lưu Niệm"
                            icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                            color="bg-gradient-to-br from-teal-500 to-emerald-600"
                            accent="bg-gradient-to-r from-teal-500 to-emerald-500"
                            stats={groupedGoods.souvenir} totalRevenue={totalRevenue}
                        />
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════
                    SECTION 3 — Thành viên
                ═══════════════════════════════════════════════════════ */}
                <section>
                    <SectionHeader title="👥 Phân tích Thành viên" subtitle="Thống kê thẻ thành viên trong ngày" />
                    <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        <SmallMetricCard index={6} label="Thành viên mới" value={memberStats?.newMemberAmount ?? 0}
                            color="bg-indigo-100 dark:bg-indigo-900/30"
                            icon={<svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
                        />
                        <SmallMetricCard index={7} label="Lượt khách đến cửa hàng" value={memberStats?.goShopMemberAmount ?? 0}
                            color="bg-teal-100 dark:bg-teal-900/30"
                            icon={<svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                        />
                        <SmallMetricCard index={8} label="Tổng thành viên hệ thống" value={(memberStats?.memberTotal ?? 0).toLocaleString()}
                            color="bg-violet-100 dark:bg-violet-900/30"
                            icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                        />
                        <SmallMetricCard index={9} label="Tiền VNĐ (nghìn VNĐ)" value={fmtVND(memberStats?.localCurrency ?? 0)}
                            color="bg-amber-100 dark:bg-amber-900/30"
                            icon={<svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                        />
                        <SmallMetricCard index={10} label="Tiền tặng (nghìn VNĐ) (Bao gồm 3 thẻ gắp thú)" value={fmtVND(memberStats?.giftCoins ?? 0)}
                            color="bg-rose-100 dark:bg-rose-900/30"
                            icon={<svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}
                        />
                        {/* <SmallMetricCard index={11} label="Điểm tích lũy" value={(memberStats?.lotteryTicket ?? 0).toLocaleString()}
                            color="bg-cyan-100 dark:bg-cyan-900/30"
                            icon={<svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                        /> */}
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════
                    SECTION 4 — Hành vi Tiêu dùng
                ═══════════════════════════════════════════════════════ */}
                <section>
                    <SectionHeader title="📈 Hành vi Tiêu dùng" subtitle="Phân phối đơn hàng theo khung giờ trong ngày" />

                    <div className="flex flex-wrap gap-3 mb-4">
                        {[
                            { emoji: '🎯', label: 'Giá trị trung bình / đơn', value: fmtVNDFull(avgOrderValue) },
                            { emoji: '⏱️', label: 'Trung bình đơn / giờ', value: `${avgOrdersPerHour} đơn` },
                            { emoji: '📦', label: 'Tổng đơn hàng', value: `${totalOrders} đơn` },
                        ].map(item => (
                            <div key={item.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-3">
                                <span className="text-2xl">{item.emoji}</span>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                                    <p className="font-bold text-slate-800 dark:text-white text-sm">{item.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-md border border-slate-100 dark:border-slate-700"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Lượng đơn hàng theo khung giờ</h3>
                            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full font-medium">Mock data</span>
                        </div>
                        <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                            <AreaChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={2} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<HourlyTooltip />} />
                                <Area type="monotone" dataKey="orders" stroke="#14b8a6" strokeWidth={2.5}
                                    fill="url(#orderGradient)" dot={false}
                                    activeDot={{ r: 5, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {[...hourlyData].sort((a, b) => b.orders - a.orders).slice(0, 3).map((h, i) => (
                                <span key={h.hour} className="text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 px-2.5 py-1 rounded-full">
                                    {['🥇', '🥈', '🥉'][i]} {h.hour}: {h.orders} đơn
                                </span>
                            ))}
                        </div>
                    </motion.div>
                </section>

                {/* ── Footer ── */}
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                    className="text-center text-xs text-slate-400 dark:text-slate-600 pb-4"
                >
                    Dữ liệu từ hệ thống Joyworld · {fmtDate(forDate)} · Cập nhật {fmtTime(updatedAt)} · {fromCache ? 'Từ cache' : 'Trực tiếp'}
                </motion.div>

            </div>

            {/* ── AI Assistant (floating) ── */}
            <AIAssistantChat currentDate={forDate} />
        </div>
    );
}
