'use client';

import React from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Design Tokens ──────────────────────────────────────────────────────
export const CHART_PALETTE = [
    '#FFC800', // 1. B.Duck Yellow (Vàng vịt đặc trưng - rực rỡ)
    '#FF7A00', // 2. Vibrant Orange (Cam năng lượng)
    '#3AB0FF', // 3. Sky Blue (Xanh bầu trời trong trẻo)
    '#FF5E8E', // 4. Bubblegum Pink (Hồng kẹo ngọt)
    '#00D0A1', // 5. Mint Green (Xanh bạc hà tươi mát)
    '#B278FF', // 6. Lilac Purple (Tím mộng mơ)
    '#FF6B6B', // 7. Coral/Watermelon (Đỏ san hô dịu mắt)
    '#00C4D9', // 8. Aqua Teal (Xanh nước biển)
    '#A3E635', // 9. Lemon Lime (Xanh chanh lá mạ)
    '#FFB067', // 10. Peach (Cam đào)
];

const tooltipStyle = {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    fontSize: 12,
    padding: '8px 12px',
};

const fmt = (n: number) => n.toLocaleString('vi-VN');

// ── Shared Pie Label ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
        <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
            fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
            {(percent * 100).toFixed(0)}%
        </text>
    );
}

// ── Chart Card Wrapper ─────────────────────────────────────────────────
export function ChartCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn(
            'bg-white rounded-2xl border border-surface-100 p-5',
            'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.03)]',
            'hover:shadow-md transition-shadow duration-300',
            className,
        )}>
            {children}
        </div>
    );
}

export function ChartTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
    return (
        <div className="flex items-center gap-2.5 mb-5">
            <span className="w-8 h-8 rounded-lg bg-surface-50 flex items-center justify-center shrink-0">{icon}</span>
            <div>
                <h3 className="text-[13px] font-extrabold text-surface-700 leading-tight">{title}</h3>
                {subtitle && <p className="text-[10px] text-surface-400 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

export function EmptyChart({ icon, message }: { icon: React.ReactNode; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-surface-400">
            <div className="w-12 h-12 rounded-xl bg-surface-50 flex items-center justify-center mb-3">{icon}</div>
            <p className="text-xs font-medium text-center max-w-[200px]">{message}</p>
        </div>
    );
}

// ── Trend Area Chart ───────────────────────────────────────────────────
interface TrendAreaChartProps {
    data: { date: string;[key: string]: string | number }[];
    dataKeys: { key: string; color: string; name: string }[];
    height?: number;
    gradientPrefix?: string;
}

export function TrendAreaChart({ data, dataKeys, height = 260, gradientPrefix = 'area' }: TrendAreaChartProps) {
    if (data.length < 2) return null;
    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                        {dataKeys.map(dk => (
                            <linearGradient key={dk.key} id={`${gradientPrefix}_${dk.key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={dk.color} stopOpacity={0.4} />
                                <stop offset="40%" stopColor={dk.color} stopOpacity={0.1} />
                                <stop offset="95%" stopColor={dk.color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(d: string) => d.length > 5 ? d.slice(5) : d} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    {dataKeys.map((dk, i) => (
                        <Area
                            key={dk.key}
                            type="monotone"
                            dataKey={dk.key}
                            stackId="1" // Giữ nguyên xếp chồng
                            name={dk.name}
                            stroke={dk.color}
                            strokeWidth={2}
                            fill={dk.color} // Fill thẳng màu gốc luôn
                            fillOpacity={0.75} // Giảm opacity một chút để màu không bị quá gắt, giữ độ pastel
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── Donut Pie Chart ────────────────────────────────────────────────────
interface DonutPieChartProps {
    data: { name: string; value: number }[];
    height?: number;
    colors?: string[];
    showLegend?: boolean;
}

export function DonutPieChart({ data, height = 200, colors = CHART_PALETTE, showLegend = true }: DonutPieChartProps) {
    if (!data.length || data.every(d => d.value === 0)) return null;
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
        <div>
            <div style={{ height }} className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={80}
                            paddingAngle={3} dataKey="value" labelLine={false} label={PieLabel} stroke="none">
                            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {showLegend && (
                <div className="space-y-2 mt-3">
                    {data.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-[4px] shrink-0 shadow-sm" style={{ backgroundColor: colors[i % colors.length] }} />
                            <span className="flex-1 text-[12px] text-surface-600 truncate group-hover:text-surface-900 transition-colors">{item.name}</span>
                            <span className="text-[12px] font-bold text-surface-800 tabular-nums">{fmt(item.value)}</span>
                            <span className="text-[11px] text-surface-400 w-10 text-right tabular-nums">
                                {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : ''}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Horizontal Bar Chart ───────────────────────────────────────────────
interface HorizontalBarChartProps {
    data: { name: string; value: number }[];
    color?: string;
    height?: number;
    barSize?: number;
}

export function HorizontalBarChart({ data, color = CHART_PALETTE[0], height = 280, barSize = 20 }: HorizontalBarChartProps) {
    if (!data.length) return null;
    const top = data.slice(0, 10);
    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={110} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill={color} radius={[0, 8, 8, 0]} barSize={barSize}
                        name="Số lượng" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── Funnel Bar Chart (vertical, colored bars) ──────────────────────────
interface FunnelChartProps {
    data: { name: string; value: number; color: string }[];
    height?: number;
}

export function FunnelChart({ data, height = 200 }: FunnelChartProps) {
    if (!data.length) return null;
    const maxVal = Math.max(...data.map(d => d.value));
    return (
        <div className="space-y-3" style={{ minHeight: height }}>
            {data.map((item, i) => {
                const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                const convRate = i > 0 && data[i - 1].value > 0
                    ? ((item.value / data[i - 1].value) * 100).toFixed(1) + '%'
                    : null;
                return (
                    <div key={item.name}>
                        {convRate && (
                            <div className="flex items-center gap-1.5 mb-1 ml-1">
                                <div className="w-3 h-3 border-l-2 border-b-2 border-surface-300 rounded-bl" />
                                <span className="text-[10px] font-bold text-surface-400">{convRate}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-surface-600 w-28 shrink-0 truncate">{item.name}</span>
                            <div className="flex-1 h-7 bg-surface-50 rounded-lg overflow-hidden relative">
                                <div
                                    className="h-full rounded-lg transition-all duration-700 ease-out flex items-center px-3"
                                    style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: item.color }}
                                >
                                    <span className="text-[11px] font-bold text-white whitespace-nowrap drop-shadow-sm">
                                        {fmt(item.value)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Vertical Bar Comparison Chart ──────────────────────────────────────
interface VerticalBarChartProps {
    data: { name: string; value: number }[];
    height?: number;
    barSize?: number;
}

export function VerticalBarChart({ data, height = 260, barSize = 24 }: VerticalBarChartProps) {
    if (!data.length) return null;
    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.slice(0, 10)} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#a5b4fc" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={barSize} name="Clicks">
                        {data.slice(0, 10).map((_, i) => (
                            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} fillOpacity={0.85} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
