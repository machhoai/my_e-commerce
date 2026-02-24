import { useState } from 'react';
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

interface Props {
    employees: UserDoc[];
    counters: CounterDoc[];
    assignments: Record<string, string[]>; // counterId -> [userUids]
    onAssignmentChange: (newAssignments: Record<string, string[]>) => void;
    isLoading: boolean;
}

export default function DraggableSchedule({
    employees,
    counters,
    assignments,
    onAssignmentChange,
    isLoading
}: Props) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,      // ms before drag activates on touch
                tolerance: 5,    // px of movement allowed during delay
            },
        }),
        useSensor(KeyboardSensor)
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

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

    const handleRemove = (counterId: string, userId: string) => {
        const updatedCounterAssigns = (assignments[counterId] || []).filter(
            id => id !== userId
        );
        onAssignmentChange({
            ...assignments,
            [counterId]: updatedCounterAssigns,
        });
    };

    const activeUser = activeId ? employees.find(e => e.uid === activeId) : null;
    const allAssignedIds = new Set(Object.values(assignments).flat());

    const unassignedEmployees = employees.filter(e => !allAssignedIds.has(e.uid));
    const assignedEmployees = employees.filter(e => allAssignedIds.has(e.uid));

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">

                {/* Top (mobile) / Left (desktop): Registered Employees */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <h2 className="font-bold text-slate-800 text-lg border-b border-slate-100 pb-3 mb-4">
                            Nhân viên đã đăng ký ({employees.length})
                        </h2>

                        <div className="overflow-hidden max-h-60 lg:max-h-none pr-1 space-y-6">
                            {isLoading ? (
                                <div className="flex flex-col gap-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                                    ))}
                                </div>
                            ) : employees.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">Chưa có nhân viên nào đăng ký ca này.</p>
                            ) : (
                                <>
                                    {/* Unassigned Group */}
                                    <div>
                                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                            Chưa phân công ({unassignedEmployees.length})
                                        </h3>
                                        <div className="flex flex-col gap-2">
                                            {unassignedEmployees.map((user) => (
                                                <EmployeeCard key={`start_${user.uid}`} user={user} isSelected={false} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Assigned Group */}
                                    {assignedEmployees.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-semibold text-emerald-600/70 uppercase tracking-wider mb-3 pt-4 border-t border-slate-100">
                                                Đã phân công ({assignedEmployees.length})
                                            </h3>
                                            <div className="flex flex-col gap-2">
                                                {assignedEmployees.map((user) => (
                                                    <EmployeeCard key={`assigned_${user.uid}`} user={user} isSelected={true} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom (mobile) / Right (desktop): Counters */}
                <div className="lg:col-span-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {counters.map((counter) => {
                            const assignedUserIds = assignments[counter.id] || [];
                            const assignedUsers = assignedUserIds
                                .map(uid => employees.find(e => e.uid === uid))
                                .filter((e): e is UserDoc => e !== undefined);

                            return (
                                <CounterDropZone
                                    key={counter.id}
                                    counter={counter}
                                    assignedUsers={assignedUsers}
                                    onRemove={handleRemove}
                                />
                            );
                        })}

                        {counters.length === 0 && (
                            <div className="sm:col-span-2 xl:col-span-3 bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
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
                        <EmployeeCard user={activeUser} isSelected={false} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
