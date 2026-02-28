'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { UserDoc, WeeklyRegistration } from '@/types';
import { Search, UserPlus, X, UserCog, Loader2 } from 'lucide-react';
import { toLocalDateString, getWeekStart } from '@/lib/utils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
    selectedDate: string;
    selectedShiftId: string;
    registeredUids: Set<string>; // UIDs already registered for this shift
    onSuccess: () => void; // Callback to reload registered employees
}

export default function ForceAssignModal({
    isOpen,
    onClose,
    storeId,
    selectedDate,
    selectedShiftId,
    registeredUids,
    onSuccess,
}: Props) {
    const { user } = useAuth();
    const [allEmployees, setAllEmployees] = useState<UserDoc[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [addingUid, setAddingUid] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Fetch all active store employees when modal opens
    useEffect(() => {
        if (!isOpen || !storeId) return;

        async function fetchEmployees() {
            setLoading(true);
            try {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('storeId', '==', storeId)
                );
                const snap = await getDocs(usersQuery);
                const employees = snap.docs
                    .map(d => d.data() as UserDoc)
                    .filter(u => u.isActive !== false && u.role !== 'admin')
                    .sort((a, b) => a.name.localeCompare(b.name));
                setAllEmployees(employees);
            } catch {
                setError('Không thể tải danh sách nhân viên');
            } finally {
                setLoading(false);
            }
        }
        fetchEmployees();
        // Reset states when modal opens
        setSearchQuery('');
        setError('');
        setSuccessMsg('');
    }, [isOpen, storeId]);

    const availableEmployees = allEmployees
        .filter(e => !registeredUids.has(e.uid))
        .filter(e => {
            if (!searchQuery.trim()) return true;
            return e.name.toLowerCase().includes(searchQuery.toLowerCase());
        });

    const handleAdd = async (employee: UserDoc) => {
        if (!user) return;
        setAddingUid(employee.uid);
        setError('');
        setSuccessMsg('');

        try {
            const token = await user.getIdToken();
            const weekStartDate = toLocalDateString(getWeekStart(new Date(selectedDate + 'T00:00:00')));

            const res = await fetch('/api/register/force-assign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    targetUserId: employee.uid,
                    storeId,
                    weekStartDate,
                    date: selectedDate,
                    shiftId: selectedShiftId,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Không thể thêm nhân viên');
            }

            setSuccessMsg(`Đã thêm ${employee.name} vào ca ${selectedShiftId}`);
            onSuccess(); // Trigger parent to reload
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi khi thêm nhân viên');
        } finally {
            setAddingUid(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <UserCog className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 text-lg">Đăng ký thêm nhân viên</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Ca <span className="font-semibold text-amber-700">{selectedShiftId}</span> — Ngày <span className="font-semibold text-amber-700">{selectedDate}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm nhân viên theo tên..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 focus:bg-white placeholder:text-slate-400 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="mx-4 mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="mx-4 mt-3 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-100 font-medium">
                        {successMsg}
                    </div>
                )}

                {/* Employee List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-3" />
                            <span className="text-sm font-medium">Đang tải...</span>
                        </div>
                    ) : availableEmployees.length > 0 ? (
                        availableEmployees.map(emp => (
                            <div
                                key={emp.uid}
                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-amber-50/50 hover:border-amber-200 transition-all group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-700 truncate">{emp.name}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${emp.type === 'FT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {emp.type === 'FT' ? 'FT' : 'PT'}
                                        </span>
                                        {emp.role === 'manager' && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">QL</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAdd(emp)}
                                    disabled={addingUid === emp.uid}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-amber-500/20"
                                >
                                    {addingUid === emp.uid ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <UserPlus className="w-4 h-4" />
                                    )}
                                    Thêm
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <UserCog className="w-10 h-10 mb-3 text-slate-300" />
                            <p className="text-sm font-medium">
                                {searchQuery ? 'Không tìm thấy nhân viên.' : 'Tất cả nhân viên đã đăng ký ca này.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
