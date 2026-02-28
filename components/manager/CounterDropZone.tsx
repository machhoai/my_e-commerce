'use client';

import { useDroppable } from '@dnd-kit/core';
import { UserDoc, CounterDoc } from '@/types';
import { X, AlertTriangle, UserCog } from 'lucide-react';

interface Props {
    counter: CounterDoc;
    assignedUsers: UserDoc[];
    onRemove: (counterId: string, userId: string) => void;
    inactiveAssignedUids?: string[];   // UIDs of deactivated users already in this counter
    onRemoveInactive?: (uid: string) => void;
    managerAssignedUids?: Set<string>; // UIDs force-assigned by manager
}

export default function CounterDropZone({
    counter,
    assignedUsers,
    onRemove,
    inactiveAssignedUids = [],
    onRemoveInactive,
    managerAssignedUids = new Set(),
}: Props) {
    const { isOver, setNodeRef } = useDroppable({
        id: counter.id,
        data: { counter }
    });

    const totalCount = assignedUsers.length + inactiveAssignedUids.length;

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
                <div className="flex items-center gap-1.5">
                    {inactiveAssignedUids.length > 0 && (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full border border-red-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {inactiveAssignedUids.length} nghỉ
                        </span>
                    )}
                    <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-full border border-slate-200 shadow-sm">
                        {totalCount} NV
                    </span>
                </div>
            </div>

            {/* Drop Area / Employee List */}
            <div className="flex-1 p-3 flex flex-col gap-2 min-h-[120px]">
                {/* ⚠️ Inactive users already assigned — warn HR */}
                {inactiveAssignedUids.map(uid => (
                    <div
                        key={`inactive_${uid}`}
                        className="group flex items-center justify-between p-2.5 bg-red-50 border border-red-200 rounded-lg"
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                            <div className="min-w-0">
                                <p className="font-medium text-sm text-red-700 truncate">ID: {uid.slice(0, 8)}…</p>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-red-200 text-red-800">
                                    Đã nghỉ
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => onRemoveInactive?.(uid)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-md transition-all"
                            title="Gỡ khỏi lịch"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                {/* Active assigned employees */}
                {assignedUsers.length > 0 ? (
                    assignedUsers.map(user => {
                        const isForcedAssign = managerAssignedUids.has(user.uid);
                        return (
                            <div
                                key={user.uid}
                                className={`group flex items-center justify-between p-2.5 rounded-lg shadow-sm transition-colors ${isForcedAssign
                                    ? 'bg-amber-50 border border-amber-200 hover:border-amber-300'
                                    : 'bg-white border border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className={`font-medium text-sm truncate ${isForcedAssign ? 'text-amber-800' : 'text-slate-700'}`}>{user.name}</p>
                                        {isForcedAssign && (
                                            <span
                                                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 shrink-0"
                                                title="Quản lý gán ca"
                                            >
                                                <UserCog className="w-3 h-3" />
                                                Gán ca
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block ${user.type === 'FT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                            }`}>
                                            {user.type === 'FT' ? 'FT' : 'PT'}
                                        </span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block ${user.role === 'store_manager' ? 'bg-red-100 text-red-700' : user.role === 'employee' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {user.role === 'store_manager' ? 'CTH' : user.role === 'employee' ? 'NV' : 'QL'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRemove(counter.id, user.uid)}
                                    className="p-1.5 text-slate-400 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                    title="Xóa khỏi quầy"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })
                ) : inactiveAssignedUids.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                        <span className="text-sm font-medium text-slate-400">
                            {isOver ? 'Thả vào đây!' : 'Kéo nhân viên vào đây'}
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
