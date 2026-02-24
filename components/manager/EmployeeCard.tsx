import { useDraggable } from '@dnd-kit/core';
import { UserDoc } from '@/types';
import { GripVertical } from 'lucide-react';

interface Props {
    user: UserDoc;
    isSelected: boolean;
    disabled?: boolean;
}

export default function EmployeeCard({ user, isSelected, disabled = false }: Props) {
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
        flex items-center p-2 rounded-lg border text-sm select-none transition-colors
        ${isDragging ? 'opacity-50 z-50 shadow-xl border-blue-500 bg-blue-50 cursor-grabbing' : 'cursor-grab bg-white hover:border-slate-300'}
        ${isSelected && !isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
      `}
        >
            <GripVertical className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {user.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${user.type === 'FT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                        {user.type}
                    </span>
                    {isSelected && (
                        <span className="text-[10px] text-emerald-600 font-medium">Assigned</span>
                    )}
                </div>
            </div>
        </div>
    );
}
