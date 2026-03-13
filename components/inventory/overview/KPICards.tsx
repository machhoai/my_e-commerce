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
            card: "bg-success-50/50 border-success-200 dark:bg-success-950/20 dark:border-success-900/50",
            icon: "text-success-600 bg-success-100 dark:bg-success-900/50 dark:text-success-400",
            value: "text-success-700 dark:text-success-400",
        },
        warning: {
            card: "bg-warning-50/50 border-warning-200 dark:bg-warning-950/20 dark:border-warning-900/50",
            icon: "text-warning-600 bg-warning-100 dark:bg-warning-900/50 dark:text-warning-400",
            value: "text-warning-700 dark:text-warning-400",
        },
        danger: {
            card: "bg-danger-50/50 border-danger-200 dark:bg-danger-950/20 dark:border-danger-900/50",
            icon: "text-danger-600 bg-danger-100 dark:bg-danger-900/50 dark:text-danger-400",
            value: "text-danger-700 dark:text-danger-400",
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
