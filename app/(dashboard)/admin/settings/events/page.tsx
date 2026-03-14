'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { SettingsDoc, NotificationTemplate } from '@/types';
import { Save, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

// Common System Events that trigger notifications
const SYSTEM_EVENTS = [
    { key: 'SCHEDULE_PUBLISHED', label: 'Công bố / Cập nhật lịch làm việc', description: 'Gửi cho nhân viên khi lịch làm việc của họ được công bố hoặc thay đổi.' },
    { key: 'SHIFT_CHANGED', label: 'Thay đổi ca làm đột xuất', description: 'Gửi cho nhân viên khi ca làm của họ bị quản lý thay đổi ngoài kế hoạch.' },
    { key: 'SWAP_REQUEST_RECEIVED', label: 'Có người xin đổi ca', description: 'Gửi cho nhân viên khi có đồng nghiệp xin đổi ca làm với họ.' },
    { key: 'SWAP_REQUEST_APPROVED', label: 'Xin đổi ca thành công', description: 'Gửi thông báo kết quả đổi ca cho hai nhân sự liên quan.' },
];

export default function EventSettingsPage() {
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [eventMappings, setEventMappings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // 1. Load System Templates only (for events)
                const templatesQuery = query(collection(db, 'notification_templates'), where('isSystemEvent', '==', true));
                const templatesSnap = await getDocs(templatesQuery);
                const loadedTemplates: NotificationTemplate[] = [];
                templatesSnap.forEach(doc => loadedTemplates.push({ id: doc.id, ...doc.data() } as NotificationTemplate));
                setTemplates(loadedTemplates);

                // 2. Load Global Settings Document for Mappings
                const settingsRef = doc(db, 'settings', 'global');
                const settingsSnap = await getDoc(settingsRef);

                if (settingsSnap.exists()) {
                    const data = settingsSnap.data() as SettingsDoc;
                    setEventMappings(data.eventMappings || {});
                }
            } catch (error) {
                console.error("Lỗi khi tải thông tin thiết lập:", error);
                setFeedback({ type: 'error', text: 'Không thể tải thiết lập sự kiện' });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setFeedback(null);
        try {
            const settingsRef = doc(db, 'settings', 'global');
            const snap = await getDoc(settingsRef);

            if (!snap.exists()) {
                // Create minimal global settings if it doesn't exist
                await setDoc(settingsRef, {
                    id: 'global',
                    registrationOpen: false,
                    shiftTimes: [],
                    eventMappings
                } as SettingsDoc);
            } else {
                await updateDoc(settingsRef, {
                    eventMappings
                });
            }

            setFeedback({ type: 'success', text: 'Lưu cấu hình sự kiện tự động thành công!' });
        } catch (error) {
            console.error("Lỗi khi lưu thiết lập:", error);
            setFeedback({ type: 'error', text: 'Đã xảy ra lỗi khi lưu thiết lập' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleMappingChange = (eventKey: string, templateId: string) => {
        setEventMappings(prev => ({
            ...prev,
            [eventKey]: templateId
        }));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-warning-500 to-accent-500 bg-clip-text text-transparent flex items-center gap-2">
                                <Zap className="w-7 h-7 text-warning-500" />
                                Bản Đồ Sự Kiện
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Cấu hình các Mẫu Thông Báo ("Hệ thống") sẽ được tự động gửi đi khi xảy ra sự kiện.</p>
                        </div>
                    </div>
                }
            />

            {feedback && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border ${feedback.type === 'error' ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-success-50 text-success-700 border-success-200'}`}>
                    {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />}
                    <div className="text-sm font-medium">{feedback.text}</div>
                </div>
            )}

            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="bg-white border border-surface-200 shadow-sm rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/50">
                        <h2 className="font-semibold text-surface-800">Cấu hình Auto-Push</h2>
                    </div>

                    <div className="divide-y divide-surface-100">
                        {SYSTEM_EVENTS.map(sysEvent => (
                            <div key={sysEvent.key} className="p-6 sm:flex items-start justify-between gap-6 hover:bg-surface-50/50 transition-colors">
                                <div className="flex-1 mb-4 sm:mb-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-warning-400"></div>
                                        <h3 className="font-medium text-surface-900">{sysEvent.label}</h3>
                                    </div>
                                    <p className="text-sm text-surface-500 mt-1 pl-4 leading-relaxed">
                                        {sysEvent.description}
                                    </p>
                                    <div className="mt-2 pl-4">
                                        <code className="text-[10px] bg-surface-100 text-surface-500 px-1.5 py-0.5 rounded border border-surface-200 font-mono">
                                            {sysEvent.key}
                                        </code>
                                    </div>
                                </div>

                                <div className="sm:w-64 shrink-0">
                                    <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                                        Mẫu Thông Báo liên kết
                                    </label>
                                    <select
                                        value={eventMappings[sysEvent.key] || ''}
                                        onChange={(e) => handleMappingChange(sysEvent.key, e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-medium text-surface-700 shadow-sm"
                                    >
                                        <option value="">-- Không gửi Tự động --</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    {eventMappings[sysEvent.key] && !templates.find(t => t.id === eventMappings[sysEvent.key]) && (
                                        <p className="text-xs text-danger-500 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Mẫu này Đã bị xóa
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Lưu cấu hình
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 text-sm text-warning-800">
                <span className="font-semibold text-warning-900 block mb-1">Gợi ý:</span>
                Chỉ những Mẫu thông báo được đánh dấu là <strong>"Mẫu Thiết lập Hệ thống"</strong> (isSystemEvent) mới xuất hiện trong danh sách để gắn kết với các Sự kiện này.
            </div>
        </div>
    );
}
