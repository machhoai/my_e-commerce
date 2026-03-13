'use client';

import { useMemo } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { MergedProduct } from '@/app/(dashboard)/admin/inventory/overview/page';

interface InventoryChartsProps {
    merged: MergedProduct[];
}

export function InventoryCharts({ merged }: InventoryChartsProps) {
    // ── Donut: Inventory Health ──
    const healthData = useMemo(() => {
        const safe = merged.filter(d => d.stockStatus === 'safe').length;
        const low = merged.filter(d => d.stockStatus === 'low').length;
        const out = merged.filter(d => d.stockStatus === 'out').length;
        return [
            { name: 'Khỏe mạnh', value: safe, color: '#10b981' }, // emarald-500
            { name: 'Sắp hết', value: low, color: '#f59e0b' }, // warning-500
            { name: 'Hết hàng', value: out, color: '#ef4444' }, // danger-500
        ].filter(d => d.value > 0);
    }, [merged]);

    // ── Bar: Top 5 Critical ──
    const criticalData = useMemo(() => {
        return [...merged]
            .sort((a, b) => (a.currentStock - a.minStock) - (b.currentStock - b.minStock))
            .slice(0, 5)
            .map(d => {
                const code = d.companyCode || d.barcode || d.name;
                return {
                    name: code.length > 15 ? code.slice(0, 15) + '…' : code,
                    tồnKho: d.currentStock,
                    tốiThiểu: d.minStock,
                };
            });
    }, [merged]);

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Chart 1: Inventory Health Donut */}
            <Card className='p-4'>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-semibold">Tình trạng tồn kho</CardTitle>
                    <CardDescription>
                        Phân bổ {merged.length} mặt hàng theo mức độ cảnh báo hiện tại.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center sm:flex-row sm:justify-start gap-8">
                        <div className="h-[200px] w-full max-w-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={healthData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {healthData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip cursor={false} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex w-full flex-col justify-center gap-4 sm:w-auto">
                            {healthData.map((item) => (
                                <div key={item.name} className="flex items-center justify-between gap-8">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="size-3 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-sm font-medium text-surface-600">
                                            {item.name}
                                        </span>
                                    </div>
                                    <span className="text-sm font-bold text-surface-900">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Chart 2: Top Critical Items Bar Chart */}
            <Card className='p-4'>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-semibold">Top 5 Cần nhập gấp</CardTitle>
                    <CardDescription>
                        Mặt hàng có lượng tồn báo động so với mức tối thiểu.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={criticalData}
                                layout="vertical"
                                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: "#64748b" }}
                                    width={110}
                                />
                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                <Bar dataKey="tồnKho" name="Hiện tại" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                                <Bar dataKey="tốiThiểu" name="Tối thiểu" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
