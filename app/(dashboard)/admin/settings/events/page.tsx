'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { SettingsDoc, NotificationTemplate } from '@/types';
import { Save, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

// Common System Events that trigger notifications
const SYSTEM_EVENTS = [
    { key: 'SHIFT_CHANGED', label: 'Thay đổi lịch làm việc đột xuất', description: 'Gửi cho nhân viên khi lịch làm việc của họ bị quản lý thay đổi.' },
    { key: 'NEW_SCHEDULE_PUBLISHED', label: 'Công bố lịch làm việc mới', description: 'Gửi chung khi một tuần làm việc mới được áp dụng.' },
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
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                    <Zap className="w-6 h-6 text-amber-500" />
                    Bản Đồ Sự Kiện
                </h1>
                <p className="text-slate-500 mt-1">Cấu hình các Mẫu Thông Báo ("Hệ thống") sẽ được tự động gửi đi khi xảy ra sự kiện.</p>
            </div>

            {feedback && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border ${feedback.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />}
                    <div className="text-sm font-medium">{feedback.text}</div>
                </div>
            )}

            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="font-semibold text-slate-800">Cấu hình Auto-Push</h2>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {SYSTEM_EVENTS.map(sysEvent => (
                            <div key={sysEvent.key} className="p-6 sm:flex items-start justify-between gap-6 hover:bg-slate-50/50 transition-colors">
                                <div className="flex-1 mb-4 sm:mb-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                        <h3 className="font-medium text-slate-900">{sysEvent.label}</h3>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1 pl-4 leading-relaxed">
                                        {sysEvent.description}
                                    </p>
                                    <div className="mt-2 pl-4">
                                        <code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                                            {sysEvent.key}
                                        </code>
                                    </div>
                                </div>

                                <div className="sm:w-64 shrink-0">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                        Mẫu Thông Báo liên kết
                                    </label>
                                    <select
                                        value={eventMappings[sysEvent.key] || ''}
                                        onChange={(e) => handleMappingChange(sysEvent.key, e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium text-slate-700 shadow-sm"
                                    >
                                        <option value="">-- Không gửi Tự động --</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    {eventMappings[sysEvent.key] && !templates.find(t => t.id === eventMappings[sysEvent.key]) && (
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Mẫu này Đã bị xóa
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
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

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <span className="font-semibold text-amber-900 block mb-1">Gợi ý:</span>
                Chỉ những Mẫu thông báo được đánh dấu là <strong>"Mẫu Thiết lập Hệ thống"</strong> (isSystemEvent) mới xuất hiện trong danh sách để gắn kết với các Sự kiện này.
            </div>
        </div>
    );
}
