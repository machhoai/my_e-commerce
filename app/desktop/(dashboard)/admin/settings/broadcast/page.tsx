'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { StoreDoc } from '@/types';
import { Send, Megaphone } from 'lucide-react';
import { showToast } from '@/lib/utils/toast';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

type TargetType = 'ALL' | 'STORE' | 'ROLE';

export default function AdminBroadcastPage() {
    const { user, userDoc, loading: authLoading, hasPermission } = useAuth();

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetType, setTargetType] = useState<TargetType>('ALL');
    const [targetValue, setTargetValue] = useState('');

    // Data for dropdowns
    const [stores, setStores] = useState<{ id: string, name: string }[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);


    // Fetch stores on mount
    useEffect(() => {
        const fetchStores = async () => {
            try {
                const storesSnap = await getDocs(query(collection(db, 'stores')));
                const storesData = storesSnap.docs.map(doc => ({
                    id: doc.id,
                    name: (doc.data() as StoreDoc).name
                }));
                // Sort alphabetically
                storesData.sort((a, b) => a.name.localeCompare(b.name));
                setStores(storesData);
            } catch (err) {
                console.error("Error fetching stores:", err);
            }
        };

        if (userDoc?.role === 'admin' || hasPermission('page.admin.broadcast')) {
            fetchStores();
        }
    }, [userDoc]);

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !message.trim()) {
            showToast.warning('Thiếu thông tin', 'Vui lòng nhập cả Tiêu đề và Nội dung thông báo.');
            return;
        }

        if (targetType === 'STORE' && !targetValue) {
            showToast.warning('Thiếu thông tin', 'Vui lòng chọn một Cửa hàng.');
            return;
        }

        if (targetType === 'ROLE' && !targetValue) {
            showToast.warning('Thiếu thông tin', 'Vui lòng chọn một Chức vụ.');
            return;
        }

        if (!confirm('Bạn có chắc chắn muốn gửi thông báo này không?')) return;

        setIsSubmitting(true);

        try {
            if (!user) {
                throw new Error("Không tìm thấy thông tin đăng nhập. Vui lòng thử lại.");
            }
            const idToken = await user.getIdToken(true);

            const res = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    title: title.trim(),
                    message: message.trim(),
                    targetType,
                    targetValue: targetType === 'ALL' ? null : targetValue,
                })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Đã xảy ra lỗi khi gửi');

            showToast.success('Gửi thành công', data.message || 'Gửi thông báo thành công!');
            // Reset form
            setTitle('');
            setMessage('');
            setTargetType('ALL');
            setTargetValue('');

        } catch (err: unknown) {
            showToast.error('Lỗi gửi', err instanceof Error ? err.message : 'Lỗi hệ thống');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading) return <div className="p-8 text-center">Đang tải...</div>;
    if (userDoc?.role !== 'admin' && !hasPermission('page.admin.broadcast')) return <div className="p-8 text-center text-danger-500">Bạn không có quyền truy cập trang này.</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-600 to-primary-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Megaphone className="w-7 h-7 text-accent-600" />
                                Gửi Thông Báo Hệ Thống
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">
                                Tạo và gửi thông báo đẩy (Push Notifications) và cảnh báo trong ứng dụng tới nhóm người dùng được chỉ định.
                            </p>
                        </div>
                    </div>
                }
            />



            <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-surface-700">Tiêu đề thông báo <span className="text-danger-500">*</span></label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all font-medium text-surface-900 placeholder:font-normal placeholder:text-surface-400"
                            placeholder="Ví dụ: Lịch làm việc tuần sau đã được công bố"
                            maxLength={100}
                        />
                        <div className="flex justify-between items-center mt-1">
                            <div className="text-[11px] text-surface-500">Mẹo: Bạn có thể dùng <code className="bg-surface-200 px-1 rounded text-accent-600">{"{name}"}</code> để chèn tên người nhận.</div>
                            <div className="text-[10px] text-surface-400">{title.length}/100 ký tự</div>
                        </div>
                    </div>

                    {/* Message Body */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-surface-700">Nội dung chi tiết <span className="text-danger-500">*</span></label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 bg-surface-50 border border-surface-300 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all text-surface-900 resize-none"
                            placeholder="Nhập nội dung chi tiết của thông báo..."
                            maxLength={500}
                        />
                        <div className="flex justify-between items-center mt-1">
                            <div className="text-[11px] text-surface-500">Mẹo: Bạn có thể dùng <code className="bg-surface-200 px-1 rounded text-accent-600">{"{name}"}</code> để chèn tên người nhận.</div>
                            <div className="text-[10px] text-surface-400">{message.length}/500 ký tự</div>
                        </div>
                    </div>

                    {/* Target Audience */}
                    <div className="space-y-2 pt-4 border-t border-surface-100">
                        <label className="text-sm font-semibold text-surface-700">Đối tượng nhận thông báo <span className="text-danger-500">*</span></label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select
                                value={targetType}
                                onChange={(e) => {
                                    setTargetType(e.target.value as TargetType);
                                    setTargetValue('');
                                }}
                                className="w-full px-4 py-2.5 bg-white border border-surface-300 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all font-medium text-surface-800"
                            >
                                <option value="ALL">Tất cả hệ thống</option>
                                <option value="STORE">Theo Cửa hàng cụ thể</option>
                                <option value="ROLE">Theo Chức vụ</option>
                            </select>

                            {/* Conditional Second Dropdown */}
                            {targetType === 'STORE' && (
                                <select
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-surface-300 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all font-medium text-surface-800 animate-in fade-in"
                                >
                                    <option value="" disabled>-- Chọn Cửa hàng --</option>
                                    {stores.map(store => (
                                        <option key={store.id} value={store.id}>{store.name}</option>
                                    ))}
                                </select>
                            )}

                            {targetType === 'ROLE' && (
                                <select
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-surface-300 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all font-medium text-surface-800 animate-in fade-in"
                                >
                                    <option value="" disabled>-- Chọn Chức vụ --</option>
                                    <option value="store_manager">Cửa hàng trưởng</option>
                                    <option value="manager">Quản lý (Manager)</option>
                                    <option value="employee">Nhân viên (Employee)</option>
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Submit Area */}
                    <div className="pt-6 border-t border-surface-100 flex items-center justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting || !title.trim() || !message.trim()}
                            className="flex items-center gap-2 px-8 py-3 bg-accent-600 hover:bg-accent-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-accent-600/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                            )}
                            Gửi Thông Báo
                        </button>
                    </div>

                </form>
            </div>

            {/* Context Note */}
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 text-sm text-surface-500">
                <span className="font-semibold text-surface-700">Lưu ý:</span> Việc gửi thông báo hàng loạt có thể mất vài giây để hoàn tất tùy vào số lượng người nhận. Thông báo sẽ xuất hiện ở chuông thông báo trong ứng dụng, và đẩy ra ngoài màn hình (Push Notification) nếu người dùng đang không trực tiếp mở ứng dụng.
            </div>

        </div>
    );
}
