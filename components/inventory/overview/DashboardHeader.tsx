'use client';

import { Warehouse } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { WarehouseDoc } from '@/types';

interface DashboardHeaderProps {
    warehouses?: any[]; // Making optional and any[] to accept stores/counters etc without strict typing if not needed
    selectedWarehouseId?: string;
    onWarehouseChange?: (id: string) => void;
    titleChildren?: React.ReactNode;
    showSelect?: boolean;
    type?: 'warehouse' | 'store';
}

export function DashboardHeader({ warehouses = [], selectedWarehouseId = '', onWarehouseChange = () => { }, titleChildren, showSelect = true, type = 'warehouse' }: DashboardHeaderProps) {
    const isStore = type === 'store';
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 flex-1">
                {titleChildren}
            </div>

            {showSelect && (
                <Select value={selectedWarehouseId} onValueChange={onWarehouseChange}>
                    <SelectTrigger className="w-fit bg-white border-slate-200">
                        <SelectValue placeholder={isStore ? 'Chọn cửa hàng' : 'Chọn kho'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">
                            <span className="flex items-center gap-2 font-medium">
                                📊 Tổng tất cả {isStore ? 'cửa hàng' : 'các kho'}
                            </span>
                        </SelectItem>
                        {warehouses.map(w => (
                            <SelectItem key={w.id} value={w.id}>
                                {isStore ? ((w as any).type === 'OFFICE' ? '🏢' : (w as any).type === 'CENTRAL' ? '🏭' : '🏪') : '🚀'} {w.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
    );
}
