import { useDraggable } from '@dnd-kit/core';
import { UserDoc } from '@/types';
import { GripVertical, UserCog, X, MousePointerClick, Trash2 } from 'lucide-react';
import { shortName } from '@/lib/utils';

interface Props {
    user: UserDoc;
    isSelected: boolean;
    disabled?: boolean;
    isManagerAssigned?: boolean;
    onRemove?: () => void;       // Remove force-assigned registration from pool
    onClearAll?: () => void;     // FIX 4: remove employee from ALL counters at once
    // Click-to-assign
    isClickSelected?: boolean;   // This card is the currently "picked" employee
    onClickSelect?: () => void;  // Called when the card is clicked to select/deselect
}

const typeLabel = (type: string) =>
    type === 'FT' ? 'FT' : 'PT';

export default function EmployeeCard({
    user,
    isSelected,
    disabled = false,
    isManagerAssigned = false,
    onRemove,
    onClearAll,
    isClickSelected = false,
    onClickSelect,
}: Props) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: user.uid,
        data: { user },
        disabled
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
        flex items-center p-2 rounded-lg border text-sm select-none transition-all touch-none
        ${isDragging ? 'opacity-50 z-50 shadow-xl border-primary-500 bg-primary-50 cursor-grabbing' : ''}
        ${isClickSelected && !isDragging ? 'border-primary-500 bg-primary-50 shadow-md shadow-primary-500/20 ring-2 ring-primary-400 ring-offset-1 cursor-pointer' : ''}
        ${!isClickSelected && isSelected && !isDragging && !isManagerAssigned ? 'border-success-500 bg-success-50' : ''}
        ${!isClickSelected && isSelected && !isDragging && isManagerAssigned ? 'border-warning-500 bg-warning-50' : ''}
        ${!isClickSelected && !isSelected && !isDragging && isManagerAssigned ? 'border-warning-300 bg-warning-50/50' : ''}
        ${!isClickSelected && !isSelected && !isDragging && !isManagerAssigned ? 'border-surface-200 bg-white hover:border-surface-300' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-50' : ''}
        ${onClickSelect && !isDragging ? 'cursor-pointer' : !isDragging ? 'cursor-grab' : ''}
      `}
        >
            {/* Drag handle — also triggers onClickSelect */}
            <div
                {...listeners}
                {...attributes}
                onPointerDown={(e) => {
                    (listeners as any)?.onPointerDown?.(e);
                }}
                onClick={() => {
                    // FIX 2: allow click regardless of isSelected state
                    onClickSelect?.();
                }}
                className="flex items-center gap-2 flex-1 min-w-0"
            >
                {isClickSelected
                    ? <MousePointerClick className="w-4 h-4 text-primary-500 mr-2 shrink-0" />
                    : <GripVertical className="w-4 h-4 text-surface-400 mr-2 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isClickSelected ? 'text-primary-700' : user.role === 'store_manager' ? 'text-danger-600' : user.role === 'manager' ? 'text-warning-600' : user.type === 'FT' ? 'text-primary-600' : 'text-success-600'}`}>
                        {shortName(user.name)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {isClickSelected && (
                            <span className="text-[10px] text-primary-600 font-bold flex items-center gap-0.5 animate-pulse">
                                Đang chọn...
                            </span>
                        )}
                        {!isClickSelected && isManagerAssigned && (
                            <span className="text-[10px] text-warning-600 font-bold flex items-center gap-0.5" title="Quản lý gán ca">
                                <UserCog className="w-3 h-3" />
                                Gán ca
                            </span>
                        )}
                        {!isClickSelected && isSelected && !isManagerAssigned && (
                            <span className="text-[10px] text-success-600 font-medium">Đã phân công</span>
                        )}
                    </div>
                </div>
            </div>

            {/* FIX 4: "Unassign from all counters" button — shown on assigned cards */}
            {onClearAll && !isClickSelected && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onClearAll();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="ml-1 p-1.5 rounded-md text-surface-300 hover:text-danger-500 hover:bg-danger-50 transition-colors shrink-0"
                    title="Gỡ khỏi tất cả quầy"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}

            {/* Hủy gán button — only for manager-assigned employees in pool */}
            {onRemove && isManagerAssigned && !isClickSelected && !isSelected && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemove();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="ml-1 p-1.5 rounded-md text-danger-400 hover:text-danger-600 hover:bg-danger-50 transition-colors shrink-0"
                    title="Hủy gán ca"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
