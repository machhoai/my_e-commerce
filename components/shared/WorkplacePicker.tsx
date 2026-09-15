'use client';

import { Building2, Store, Warehouse } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const icon = { STORE: Store, OFFICE: Building2, CENTRAL: Warehouse } as const;
const label = { STORE: 'Cửa hàng', OFFICE: 'Văn phòng', CENTRAL: 'Kho' } as const;

interface WorkplacePickerProps {
    compact?: boolean;
    className?: string;
}

export function WorkplacePicker({ compact = false, className }: WorkplacePickerProps) {
    const { workplaces, activeWorkplace, setActiveWorkplaceKey } = useAuth();
    const active = workplaces.filter(item => item.isEffective && item.isActive);
    if (active.length <= 1) return null;
    const ActiveIcon = activeWorkplace ? icon[activeWorkplace.workplace.type] : Building2;

    return (
        <label className={cn('flex items-center gap-2', compact ? 'min-w-0' : 'w-full', className)}>
            <ActiveIcon className="size-4 shrink-0 text-surface-500" />
            <select
                value={activeWorkplace?.workplace.key || ''}
                onChange={event => setActiveWorkplaceKey(event.target.value)}
                className={`${compact ? 'max-w-[210px]' : 'flex-1'} min-w-0 rounded-xl border border-surface-200 bg-white px-2.5 py-2 text-xs font-medium text-surface-700 outline-none focus:ring-2 focus:ring-primary-300`}
                aria-label="Chọn nơi làm việc đang thao tác"
            >
                {active.map(item => (
                    <option key={item.id} value={item.workplace.key}>
                        {label[item.workplace.type]} · {item.name}
                    </option>
                ))}
            </select>
        </label>
    );
}
