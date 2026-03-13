'use client';

import { useDroppable } from '@dnd-kit/core';
import { UserDoc, CounterDoc } from '@/types';
import { X, AlertTriangle, UserCog, MousePointerClick } from 'lucide-react';
import { shortName } from '@/lib/utils';

interface Props {
    counter: CounterDoc;
    assignedUsers: UserDoc[];
    onRemove: (counterId: string, userId: string) => void;
    inactiveAssignedUids?: string[];   // UIDs of deactivated users already in this counter
    onRemoveInactive?: (uid: string) => void;
    managerAssignedUids?: Set<string>; // UIDs force-assigned by manager
    // Click-to-assign
    isClickAssignMode?: boolean;       // True when an employee has been "selected" in the pool
    onClickAssign?: () => void;        // Called when counter zone is clicked in assign mode
}

export default function CounterDropZone({
    counter,
    assignedUsers,
    onRemove,
    inactiveAssignedUids = [],
    onRemoveInactive,
    managerAssignedUids = new Set(),
    isClickAssignMode = false,
    onClickAssign,
}: Props) {
    const { isOver, setNodeRef } = useDroppable({
        id: counter.id,
        data: { counter }
    });

    const totalCount = assignedUsers.length + inactiveAssignedUids.length;
    const isHighlighted = isOver || isClickAssignMode;

    return (
        <div
            ref={setNodeRef}
            onClick={() => {
                if (isClickAssignMode && onClickAssign) onClickAssign();
            }}
            className={`
        flex flex-col h-full rounded-xl border-2 transition-all overflow-hidden
        ${isOver ? 'border-primary-400 bg-primary-50 shadow-lg shadow-primary-500/10' : ''}
        ${isClickAssignMode && !isOver ? 'border-primary-300 bg-primary-50/40 cursor-pointer hover:border-primary-500 hover:bg-primary-50 hover:shadow-md hover:shadow-primary-500/10' : ''}
        ${!isClickAssignMode && !isOver ? 'border-surface-200 bg-white' : ''}
      `}
        >
            {/* Header */}
            <div className={`border-b p-3 flex items-center justify-between transition-colors ${isHighlighted ? 'bg-primary-50 border-primary-200' : 'bg-surface-50 border-surface-200'}`}>
                <h3 className="font-semibold text-surface-800">{counter.name}</h3>
                <div className="flex items-center gap-1.5">
                    {inactiveAssignedUids.length > 0 && (
                        <span className="text-xs font-bold text-danger-600 bg-danger-100 px-2 py-1 rounded-full border border-danger-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {inactiveAssignedUids.length} nghỉ
                        </span>
                    )}
                    {isClickAssignMode && (
                        <span className="text-xs font-bold text-primary-600 bg-primary-100 px-2 py-1 rounded-full border border-primary-200 flex items-center gap-1">
                            <MousePointerClick className="w-3 h-3" />
                        </span>
                    )}
                    <span className="text-xs font-medium truncate text-surface-500 bg-white px-2 py-1 rounded-full border border-surface-200 shadow-sm">
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
                        className="group flex items-center justify-between p-2.5 bg-danger-50 border border-danger-200 rounded-lg"
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <AlertTriangle className="w-4 h-4 text-danger-500 shrink-0" />
                            <div className="min-w-0">
                                <p className="font-medium text-sm text-danger-700 truncate">ID: {uid.slice(0, 8)}…</p>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-danger-200 text-danger-800">
                                    Đã nghỉ
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemoveInactive?.(uid); }}
                            className="p-1.5 text-danger-400 hover:text-danger-600 hover:bg-danger-100 rounded-md transition-all"
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
                                    ? 'bg-warning-50 border border-warning-200 hover:border-warning-300'
                                    : 'bg-white border border-surface-200 hover:border-surface-300'
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className={`font-medium text-sm truncate ${user.role === 'store_manager' ? 'text-danger-600' : user.role === 'manager' ? 'text-warning-600' : user.type === 'FT' ? 'text-primary-600' : 'text-success-600'}`}>{shortName(user.name)}</p>
                                        {isForcedAssign && (
                                            <span
                                                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-warning-200 text-warning-800 shrink-0"
                                                title="Quản lý gán ca"
                                            >
                                                <UserCog className="w-3 h-3" />
                                                Gán ca
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove(counter.id, user.uid); }}
                                    className="p-1.5 text-surface-400 group-hover:opacity-100 hover:text-danger-500 hover:bg-danger-50 rounded-md transition-all"
                                    title="Xóa khỏi quầy"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })
                ) : inactiveAssignedUids.length === 0 ? (
                    <div className={`flex-1 flex items-center justify-center border-2 border-dashed rounded-lg transition-colors ${isClickAssignMode
                        ? 'border-primary-300 bg-primary-50/50'
                        : isOver
                            ? 'border-primary-400 bg-primary-50'
                            : 'border-surface-200 bg-surface-50/50'
                        }`}>
                        <span className={`text-sm font-medium ${isClickAssignMode ? 'text-primary-500' : 'text-surface-400'}`}>
                            {isOver ? 'Thả vào đây!' : isClickAssignMode ? 'Nhấn để gán nhân viên' : 'Kéo nhân viên vào đây'}
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
