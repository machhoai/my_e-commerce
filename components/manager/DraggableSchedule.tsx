import { useState, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { UserDoc, CounterDoc } from '@/types';
import EmployeeCard from './EmployeeCard';
import CounterDropZone from './CounterDropZone';
import { UserPlus } from 'lucide-react';

interface Props {
    employees: UserDoc[];
    counters: CounterDoc[];
    assignments: Record<string, string[]>; // counterId -> [userUids]
    onAssignmentChange: (newAssignments: Record<string, string[]>) => void;
    isLoading: boolean;
    inactiveUids?: Set<string>; // UIDs of deactivated accounts already in assignments
    managerAssignedUids?: Set<string>; // UIDs force-assigned by manager
    onRemoveRegistration?: (uid: string) => void; // Callback to remove a force-assigned registration
    setShowForceAssignModal?: (show: boolean) => void;
    selectedShiftId?: string;
}

export default function DraggableSchedule({
    employees,
    counters,
    assignments,
    onAssignmentChange,
    isLoading,
    inactiveUids = new Set(),
    managerAssignedUids = new Set(),
    onRemoveRegistration,
    setShowForceAssignModal,
    selectedShiftId,
}: Props) {
    const [activeId, setActiveId] = useState<string | null>(null);
    // Click-to-Assign: tracks which employee card has been "clicked to select"
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor)
    );

    // Valid counter IDs — used to guard against false drops
    const validCounterIds = useMemo(() => new Set(counters.map(c => c.id)), [counters]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        // Starting a drag cancels the click-to-assign selection
        setSelectedEmployeeId(null);
    };

    // FIX 1: Only assign if dropped onto a valid counter drop zone
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        // Guard: no drop target or target is not a real counter
        if (!over || !validCounterIds.has(over.id as string)) return;

        const userId = active.id as string;
        const counterId = over.id as string;

        const currentCounterAssigns = assignments[counterId] || [];
        if (!currentCounterAssigns.includes(userId)) {
            onAssignmentChange({
                ...assignments,
                [counterId]: [...currentCounterAssigns, userId],
            });
        }
    };

    // FIX 3: Keep employee selected after assigning — don't clear selectedEmployeeId
    const handleClickAssign = (counterId: string) => {
        if (!selectedEmployeeId) return;
        const currentCounterAssigns = assignments[counterId] || [];
        if (!currentCounterAssigns.includes(selectedEmployeeId)) {
            onAssignmentChange({
                ...assignments,
                [counterId]: [...currentCounterAssigns, selectedEmployeeId],
            });
        }
        // Intentionally NOT clearing selectedEmployeeId here so the user can
        // keep clicking other counters to assign the same employee
    };

    const handleRemove = (counterId: string, userId: string) => {
        const updatedCounterAssigns = (assignments[counterId] || []).filter(
            id => id !== userId
        );
        onAssignmentChange({
            ...assignments,
            [counterId]: updatedCounterAssigns,
        });
    };

    // FIX 4: Remove an employee from ALL counters in one click
    const removeFromAllCounters = (userId: string) => {
        const updated: Record<string, string[]> = {};
        for (const [counterId, uids] of Object.entries(assignments)) {
            updated[counterId] = uids.filter(id => id !== userId);
        }
        onAssignmentChange(updated);
        // Also deselect if this was the selected employee
        if (selectedEmployeeId === userId) setSelectedEmployeeId(null);
    };

    const activeUser = activeId ? employees.find(e => e.uid === activeId) : null;
    const allAssignedIds = useMemo(() => new Set(Object.values(assignments).flat()), [assignments]);

    const unassignedEmployees = employees.filter(e => !allAssignedIds.has(e.uid));
    const assignedEmployees = employees.filter(e => allAssignedIds.has(e.uid));

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6">

                {/* Left panel: Employee pool */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col">
                        <h2 className="font-bold text-surface-800 text-lg">
                            Nhân viên đã đăng ký ({employees.length})
                        </h2>
                        <span className="text-xs text-surface-500 border-b border-surface-100 pb-3 mb-4">
                            Nhấn vào một quầy để gán nhân viên, hoặc nhấn lại thẻ để hủy chọn. Hoặc có thể kéo nhân viên vào quầy.
                        </span>

                        {/* Active selection banner */}
                        {selectedEmployeeId && (
                            <div className="mb-3 px-3 py-2 rounded-lg bg-primary-50 border border-primary-200 text-xs font-medium text-primary-700 flex items-center justify-between gap-2">
                                <span>👆 Nhấn vào quầy để gán. Nhấn lại thẻ để hủy chọn.</span>
                                <button
                                    onClick={() => setSelectedEmployeeId(null)}
                                    className="text-primary-400 hover:text-primary-700 font-bold shrink-0"
                                >
                                    Xong
                                </button>
                            </div>
                        )}

                        <div className="lg:max-h-none pr-1 space-y-6">
                            {isLoading ? (
                                <div className="flex flex-col gap-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-14 bg-surface-100 rounded-lg animate-pulse" />
                                    ))}
                                </div>
                            ) : employees.length === 0 ? (
                                <p className="text-sm text-surface-500 text-center py-8">Chưa có nhân viên nào đăng ký ca này.</p>
                            ) : (
                                <>
                                    {/* Unassigned Group */}
                                    <div>
                                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                                            Chưa phân công ({unassignedEmployees.length})
                                        </h3>
                                        <div className="flex flex-col gap-2">
                                            {unassignedEmployees.map((user) => (
                                                <EmployeeCard
                                                    key={`start_${user.uid}`}
                                                    user={user}
                                                    isSelected={false}
                                                    isClickSelected={selectedEmployeeId === user.uid}
                                                    onClickSelect={() => {
                                                        // Toggle: clicking already-selected card deselects
                                                        setSelectedEmployeeId(prev =>
                                                            prev === user.uid ? null : user.uid
                                                        );
                                                    }}
                                                    isManagerAssigned={managerAssignedUids.has(user.uid)}
                                                    onRemove={managerAssignedUids.has(user.uid) && onRemoveRegistration
                                                        ? () => onRemoveRegistration(user.uid)
                                                        : undefined}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* FIX 2 + 4: Assigned employees — fully clickable + unassign-all button */}
                                    {assignedEmployees.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-semibold text-success-600/70 uppercase tracking-wider mb-3 pt-4 border-t border-surface-100">
                                                Đã phân công ({assignedEmployees.length})
                                            </h3>
                                            <div className="flex flex-col gap-2">
                                                {assignedEmployees.map((user) => (
                                                    <EmployeeCard
                                                        key={`assigned_${user.uid}`}
                                                        user={user}
                                                        isSelected={true}
                                                        isClickSelected={selectedEmployeeId === user.uid}
                                                        onClickSelect={() => {
                                                            // FIX 2: assigned cards are also clickable for multi-counter assign
                                                            setSelectedEmployeeId(prev =>
                                                                prev === user.uid ? null : user.uid
                                                            );
                                                        }}
                                                        isManagerAssigned={managerAssignedUids.has(user.uid)}
                                                        onRemove={managerAssignedUids.has(user.uid) && onRemoveRegistration
                                                            ? () => onRemoveRegistration(user.uid)
                                                            : undefined}
                                                        onClearAll={() => removeFromAllCounters(user.uid)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="flex w-full items-center gap-3">
                                <button
                                    onClick={() => setShowForceAssignModal?.(true)}
                                    disabled={isLoading || !selectedShiftId}
                                    className="flex items-center w-full justify-center gap-2 px-4 py-2.5 bg-warning-500 hover:bg-warning-600 text-white rounded-xl font-semibold text-sm transition-all shadow-sm shadow-warning-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Đăng ký thêm nhân viên
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right panel: Counters */}
                <div className="lg:col-span-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {counters.map((counter) => {
                            const assignedUserIds = assignments[counter.id] || [];

                            const activeAssigned = assignedUserIds
                                .filter(uid => !inactiveUids.has(uid))
                                .map(uid => employees.find(e => e.uid === uid))
                                .filter((e): e is UserDoc => e !== undefined);

                            const inactiveAssignedUids = assignedUserIds.filter(uid => inactiveUids.has(uid));

                            return (
                                <CounterDropZone
                                    key={counter.id}
                                    counter={counter}
                                    assignedUsers={activeAssigned}
                                    onRemove={handleRemove}
                                    inactiveAssignedUids={inactiveAssignedUids}
                                    onRemoveInactive={(uid: string) => handleRemove(counter.id, uid)}
                                    managerAssignedUids={managerAssignedUids}
                                    isClickAssignMode={selectedEmployeeId !== null}
                                    onClickAssign={() => handleClickAssign(counter.id)}
                                />
                            );
                        })}

                        {counters.length === 0 && (
                            <div className="sm:col-span-2 xl:col-span-3 bg-white border-2 border-dashed border-surface-300 rounded-2xl p-12 text-center text-surface-500">
                                Chưa có quầy nào được cấu hình. Vào Cài đặt hệ thống để thêm quầy.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
                {activeUser ? (
                    <div className="transform rotate-3 shadow-2xl scale-105 transition-transform duration-75">
                        <EmployeeCard user={activeUser} isSelected={false} isManagerAssigned={managerAssignedUids.has(activeUser.uid)} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
