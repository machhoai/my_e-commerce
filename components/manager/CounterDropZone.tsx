import { useDroppable } from '@dnd-kit/core';
import { UserDoc, CounterDoc } from '@/types';
import { X } from 'lucide-react';

interface Props {
    counter: CounterDoc;
    assignedUsers: UserDoc[];
    onRemove: (counterId: string, userId: string) => void;
}

export default function CounterDropZone({ counter, assignedUsers, onRemove }: Props) {
    const { isOver, setNodeRef } = useDroppable({
        id: counter.id,
        data: { counter }
    });

    return (
        <div
            ref={setNodeRef}
            className={`
        flex flex-col h-full rounded-xl border-2 transition-colors overflow-hidden
        ${isOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}
      `}
        >
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">{counter.name}</h3>
                <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-full border border-slate-200 shadow-sm">
                    {assignedUsers.length} nhân viên
                </span>
            </div>

            {/* Drop Area / Employee List */}
            <div className="flex-1 p-3 flex flex-col gap-2 min-h-[120px]">
                {assignedUsers.length > 0 ? (
                    assignedUsers.map(user => (
                        <div
                            key={user.uid}
                            className="group flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-700 truncate">{user.name}</p>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block ${user.type === 'FT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                    }`}>
                                    {user.type === 'FT' ? 'TT' : 'BT'}
                                </span>
                            </div>
                            <button
                                onClick={() => onRemove(counter.id, user.uid)}
                                className="p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                title="Xóa khỏi quầy"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                        <span className="text-sm font-medium text-slate-400">
                            {isOver ? 'Thả vào đây!' : 'Kéo nhân viên vào đây'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
