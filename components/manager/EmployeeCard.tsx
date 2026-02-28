import { useDraggable } from '@dnd-kit/core';
import { UserDoc } from '@/types';
import { GripVertical, UserCog, X } from 'lucide-react';

interface Props {
    user: UserDoc;
    isSelected: boolean;
    disabled?: boolean;
    isManagerAssigned?: boolean;
    onRemove?: () => void; // Callback to remove force-assigned registration
}

const typeLabel = (type: string) =>
    type === 'FT' ? 'FT' : 'PT';

export default function EmployeeCard({ user, isSelected, disabled = false, isManagerAssigned = false, onRemove }: Props) {
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
            {...listeners}
            {...attributes}
            className={`
        flex items-center p-2 rounded-lg border text-sm select-none transition-colors touch-none
        ${isDragging ? 'opacity-50 z-50 shadow-xl border-blue-500 bg-blue-50 cursor-grabbing' : 'cursor-grab bg-white hover:border-slate-300'}
        ${isSelected && !isDragging && !isManagerAssigned ? 'border-emerald-500 bg-emerald-50' : ''}
        ${isSelected && !isDragging && isManagerAssigned ? 'border-amber-500 bg-amber-50' : ''}
        ${!isSelected && !isDragging && isManagerAssigned ? 'border-amber-300 bg-amber-50/50' : ''}
        ${!isSelected && !isDragging && !isManagerAssigned ? 'border-slate-200' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
      `}
        >
            <GripVertical className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${isManagerAssigned ? 'text-amber-900' : isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {user.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${user.type === 'FT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                        {typeLabel(user.type)}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase inline-block ${user.role === 'store_manager' ? 'bg-red-100 text-red-700' : user.role === 'employee' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        {user.role === 'store_manager' ? 'CTH' : user.role === 'employee' ? 'NV' : 'QL'}
                    </span>
                    {isManagerAssigned && (
                        <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5" title="Quản lý gán ca">
                            <UserCog className="w-3 h-3" />
                            Gán ca
                        </span>
                    )}
                    {isSelected && !isManagerAssigned && (
                        <span className="text-[10px] text-emerald-600 font-medium">Đã phân công</span>
                    )}
                </div>
            </div>
            {/* Hủy gán button — only for manager-assigned employees */}
            {onRemove && isManagerAssigned && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemove();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="ml-1 p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    title="Hủy gán ca"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

