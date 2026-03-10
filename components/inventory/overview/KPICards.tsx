'use client';

import { Package, TrendingUp, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MergedProduct } from '@/app/(dashboard)/admin/inventory/overview/page';

interface KPICardsProps {
    merged: MergedProduct[];
    totalValue: number;
    lowCount: number;
    outCount: number;
}

export function KPICards({ merged, totalValue, lowCount, outCount }: KPICardsProps) {
    const kpis: KPICardProps[] = [
        {
            title: "Tổng sản phẩm",
            value: merged.length,
            icon: Package,
            variant: "default" as const,
        },
        {
            title: "Giá trị tồn kho",
            value: `${totalValue.toLocaleString('vi-VN')}đ`,
            icon: TrendingUp,
            variant: "default" as const,
            smallValue: true,
        },
        {
            title: "Sắp hết hàng",
            value: lowCount,
            icon: AlertTriangle,
            variant: lowCount > 0 ? "warning" : "default" as const,
        },
        {
            title: "Hết hàng",
            value: outCount,
            icon: XCircle,
            variant: outCount > 0 ? "danger" : "default" as const,
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
                <KPICard key={kpi.title} {...kpi} />
            ))}
        </div>
    );
}

interface KPICardProps {
    title: string
    value: string | number
    icon: React.ElementType
    variant?: "default" | "success" | "warning" | "danger"
    smallValue?: boolean
}

function KPICard({ title, value, icon: Icon, variant = "default", smallValue }: KPICardProps) {
    const variants = {
        default: {
            card: "bg-card border-border",
            icon: "text-muted-foreground bg-muted",
            value: "text-foreground",
        },
        success: {
            card: "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50",
            icon: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400",
            value: "text-emerald-700 dark:text-emerald-400",
        },
        warning: {
            card: "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50",
            icon: "text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-400",
            value: "text-amber-700 dark:text-amber-400",
        },
        danger: {
            card: "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50",
            icon: "text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-400",
            value: "text-red-700 dark:text-red-400",
        },
    }

    const styles = variants[variant]

    return (
        <Card className={cn("overflow-hidden transition-all hover:shadow-md", styles.card)}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className={cn("font-bold tracking-tight", smallValue ? "text-xl sm:text-2xl" : "text-3xl", styles.value)}>
                                {value}
                            </h3>
                        </div>
                    </div>
                    <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", styles.icon)}>
                        <Icon className="size-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
