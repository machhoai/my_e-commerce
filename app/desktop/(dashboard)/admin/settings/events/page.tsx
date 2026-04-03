'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { SettingsDoc, NotificationTemplate } from '@/types';
import { Save, AlertCircle, CheckCircle2, Zap, FlaskConical, Loader2 } from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import { cn } from '@/lib/utils';

// ── System Events ──────────────────────────────────────────────────
const SYSTEM_EVENTS = [
    {
        key: 'SCHEDULE_PUBLISHED',
        label: 'Công bố / Cập nhật lịch làm việc',
        description: 'Gửi cho nhân viên khi lịch làm việc của họ được công bố hoặc thay đổi.',
        variables: ['{name}', '{shiftDate}', '{storeName}'],
    },
    {
        key: 'SHIFT_CHANGED',
        label: 'Thay đổi ca làm đột xuất',
        description: 'Gửi cho nhân viên khi ca làm của họ bị quản lý thay đổi ngoài kế hoạch.',
        variables: ['{name}', '{shiftDate}', '{oldShift}', '{newShift}', '{storeName}'],
    },
    {
        key: 'SWAP_REQUEST_RECEIVED',
        label: 'Có người xin đổi ca',
        description: 'Gửi cho nhân viên khi có đồng nghiệp xin đổi ca làm với họ.',
        variables: ['{name}', '{requesterName}', '{shiftDate}', '{storeName}'],
    },
    {
        key: 'SWAP_REQUEST_APPROVED',
        label: 'Xin đổi ca thành công',
        description: 'Gửi thông báo kết quả đổi ca cho hai nhân sự liên quan.',
        variables: ['{name}', '{partnerName}', '{shiftDate}', '{storeName}'],
    },
    {
        key: 'REFERRAL_POINTS_EARNED',
        label: '🏆 Chúc mừng nhân viên tích điểm giới thiệu',
        description: 'Broadcast đến TẤT CẢ nhân viên khi một nhân viên được cộng điểm giới thiệu thành công.',
        variables: ['{name}', '{employeeName}', '{points}', '{packageName}'],
        isNew: true,
    },
];

export default function EventSettingsPage() {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [eventMappings, setEventMappings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [testingEvent, setTestingEvent] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const templatesQuery = query(collection(db, 'notification_templates'), where('isSystemEvent', '==', true));
                const templatesSnap = await getDocs(templatesQuery);
                const loadedTemplates: NotificationTemplate[] = [];
                templatesSnap.forEach(doc => loadedTemplates.push({ id: doc.id, ...doc.data() } as NotificationTemplate));
                setTemplates(loadedTemplates);

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

    // Auto-clear feedback
    useEffect(() => {
        if (!feedback) return;
        const t = setTimeout(() => setFeedback(null), 5000);
        return () => clearTimeout(t);
    }, [feedback]);

    const handleSave = async () => {
        setIsSaving(true);
        setFeedback(null);
        try {
            const settingsRef = doc(db, 'settings', 'global');
            const snap = await getDoc(settingsRef);
            if (!snap.exists()) {
                await setDoc(settingsRef, {
                    id: 'global', registrationOpen: false, shiftTimes: [], eventMappings
                } as SettingsDoc);
            } else {
                await updateDoc(settingsRef, { eventMappings });
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
        setEventMappings(prev => ({ ...prev, [eventKey]: templateId }));
    };

    const handleTestEvent = async (eventKey: string) => {
        if (!user) return;
        setTestingEvent(eventKey);
        setFeedback(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/test-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ eventKey }),
            });
            const data = await res.json();
            if (data.success) {
                setFeedback({ type: 'success', text: data.message });
            } else {
                setFeedback({ type: 'error', text: data.error || 'Test thất bại' });
            }
        } catch {
            setFeedback({ type: 'error', text: 'Không thể kết nối đến server.' });
        } finally {
            setTestingEvent(null);
        }
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
                            <p className="text-surface-500 mt-1 text-sm">Cấu hình các Mẫu Thông Báo (&quot;Hệ thống&quot;) sẽ được tự động gửi đi khi xảy ra sự kiện.</p>
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
                            <div key={sysEvent.key} className={cn(
                                'p-6 hover:bg-surface-50/50 transition-colors',
                                sysEvent.isNew && 'bg-amber-50/30 border-l-4 border-l-amber-400',
                            )}>
                                <div className="sm:flex items-start justify-between gap-6">
                                    <div className="flex-1 mb-4 sm:mb-0">
                                        <div className="flex items-center gap-2">
                                            <div className={cn('w-2 h-2 rounded-full', sysEvent.isNew ? 'bg-amber-500' : 'bg-warning-400')}></div>
                                            <h3 className="font-medium text-surface-900">{sysEvent.label}</h3>
                                            {sysEvent.isNew && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wider">Mới</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-surface-500 mt-1 pl-4 leading-relaxed">
                                            {sysEvent.description}
                                        </p>
                                        <div className="mt-2 pl-4 flex flex-wrap items-center gap-1.5">
                                            <code className="text-[10px] bg-surface-100 text-surface-500 px-1.5 py-0.5 rounded border border-surface-200 font-mono">
                                                {sysEvent.key}
                                            </code>
                                            {sysEvent.variables.map(v => (
                                                <code key={v} className="text-[10px] bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded border border-primary-100 font-mono">
                                                    {v}
                                                </code>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="sm:w-64 shrink-0 space-y-2">
                                        <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider">
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
                                            <p className="text-xs text-danger-500 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                Mẫu này Đã bị xóa
                                            </p>
                                        )}

                                        {/* Test Button */}
                                        <button
                                            onClick={() => handleTestEvent(sysEvent.key)}
                                            disabled={!eventMappings[sysEvent.key] || testingEvent === sysEvent.key}
                                            className={cn(
                                                'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm',
                                                eventMappings[sysEvent.key]
                                                    ? 'bg-violet-500 hover:bg-violet-600 text-white cursor-pointer'
                                                    : 'bg-surface-100 text-surface-400 cursor-not-allowed',
                                            )}
                                        >
                                            {testingEvent === sysEvent.key ? (
                                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang test...</>
                                            ) : (
                                                <><FlaskConical className="w-3.5 h-3.5" /> Test sự kiện</>
                                            )}
                                        </button>
                                    </div>
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

            <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 text-sm text-warning-800 space-y-2">
                <span className="font-semibold text-warning-900 block">Gợi ý:</span>
                <p>
                    Chỉ những Mẫu thông báo được đánh dấu là <strong>&quot;Mẫu Thiết lập Hệ thống&quot;</strong> (isSystemEvent) mới xuất hiện trong danh sách để gắn kết với các Sự kiện này.
                </p>
                <p>
                    Bấm <strong>&quot;Test sự kiện&quot;</strong> để gửi thử thông báo push đến chính bạn. Sự kiện phải được map với mẫu trước.
                </p>
            </div>
        </div>
    );
}
