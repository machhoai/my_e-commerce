'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { NotificationDoc } from '@/types';
import { Bell, Check, CheckCircle2, ChevronRight, ChevronLeft, Info, BellOff, Sparkles, ExternalLink, Bug } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PushDebugPanel } from '@/components/debug/PushDebugPanel';

type FilterTab = 'all' | 'unread';

export default function MobileNotificationsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [markingAll, setMarkingAll] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [debugTaps, setDebugTaps] = useState(0);
    const [showDebug, setShowDebug] = useState(false);

    // Triple-tap the header icon to reveal the debug panel
    const handleDebugTap = () => {
        setDebugTaps(prev => {
            const next = prev + 1;
            if (next >= 3) {
                setShowDebug(s => !s);
                return 0;
            }
            return next;
        });
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Real-time listener
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as NotificationDoc[];

            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setNotifications(data);
            setLoading(false);
        }, (error) => {
            console.error("Lỗi khi lấy thông báo:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleNotificationClick = async (notification: NotificationDoc) => {
        // Toggle expand/collapse
        const isExpanding = expandedId !== notification.id;
        setExpandedId(isExpanding ? notification.id : null);

        // Mark as read when expanding
        if (isExpanding && !notification.isRead) {
            try {
                const docRef = doc(db, 'notifications', notification.id);
                await updateDoc(docRef, { isRead: true });
            } catch (error) {
                console.error("Error updating notification status:", error);
            }
        }
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0 || !user || markingAll) return;
        setMarkingAll(true);
        try {
            const batch = writeBatch(db);
            const unreadDocs = notifications.filter(n => !n.isRead).slice(0, 500);
            unreadDocs.forEach(n => {
                const docRef = doc(db, 'notifications', n.id);
                batch.update(docRef, { isRead: true });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error marking all as read:", error);
        } finally {
            setMarkingAll(false);
        }
    };

    const typeConfig: Record<string, { icon: React.ReactNode; bgColor: string; borderColor: string }> = {
        SYSTEM: {
            icon: <Info className="w-4.5 h-4.5 text-primary-600" />,
            bgColor: 'bg-primary-50',
            borderColor: 'border-primary-100',
        },
        SWAP_REQUEST: {
            icon: <ChevronRight className="w-4.5 h-4.5 text-warning-600" />,
            bgColor: 'bg-warning-50',
            borderColor: 'border-warning-100',
        },
        APPROVAL: {
            icon: <CheckCircle2 className="w-4.5 h-4.5 text-success-600" />,
            bgColor: 'bg-success-50',
            borderColor: 'border-success-100',
        },
        GENERAL: {
            icon: <Bell className="w-4.5 h-4.5 text-surface-500" />,
            bgColor: 'bg-surface-50',
            borderColor: 'border-surface-100',
        },
    };

    const getTypeConfig = (type: string) => typeConfig[type] || typeConfig.GENERAL;

    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(n => !n.isRead)
        : notifications;

    // Group by date
    const groupByDate = (items: NotificationDoc[]) => {
        const groups: { label: string; items: NotificationDoc[] }[] = [];
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayStr = today.toDateString();
        const yestStr = yesterday.toDateString();

        const map = new Map<string, NotificationDoc[]>();

        items.forEach(item => {
            const d = new Date(item.createdAt);
            let key: string;
            const dStr = d.toDateString();
            if (dStr === todayStr) key = 'Hôm nay';
            else if (dStr === yestStr) key = 'Hôm qua';
            else key = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        });

        map.forEach((items, label) => groups.push({ label, items }));
        return groups;
    };

    const grouped = groupByDate(filteredNotifications);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* ── Sticky native-style header ───────────────────────── */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm safe-area-top">
                <div className="flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={() => router.back()}
                        className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-transform shrink-0"
                        aria-label="Quay lại"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-bold text-gray-900 truncate">Thông báo</h1>
                        {unreadCount > 0 && (
                            <p className="text-[11px] text-gray-400">
                                {unreadCount} chưa đọc
                            </p>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            disabled={markingAll}
                            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-50 shrink-0"
                        >
                            {markingAll ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Check className="w-3.5 h-3.5" />
                            )}
                            Đọc hết
                        </button>
                    )}
                    {/* Hidden debug entry — triple-tap to toggle */}
                    <button
                        onClick={handleDebugTap}
                        className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors shrink-0 opacity-20 active:opacity-60"
                        aria-label="Debug"
                    >
                        <Bug className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 px-4 pb-2">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={cn(
                            'flex-1 py-2 rounded-xl text-xs font-bold transition-all',
                            activeTab === 'all'
                                ? 'bg-gray-900 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-500'
                        )}
                    >
                        Tất cả ({notifications.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('unread')}
                        className={cn(
                            'flex-1 py-2 rounded-xl text-xs font-bold transition-all relative',
                            activeTab === 'unread'
                                ? 'bg-gray-900 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-500'
                        )}
                    >
                        Chưa đọc
                        {unreadCount > 0 && (
                            <span className={cn(
                                'ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1',
                                activeTab === 'unread'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-red-500 text-white'
                            )}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* ── Notification list ────────────────────────────────── */}
            <main className="flex-1 px-3 pb-6 pt-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-xs text-gray-400">Đang tải thông báo...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                            {activeTab === 'unread' ? (
                                <Sparkles className="w-7 h-7 text-emerald-400" />
                            ) : (
                                <BellOff className="w-7 h-7 text-gray-300" />
                            )}
                        </div>
                        <h3 className="text-sm font-bold text-gray-700 mb-1">
                            {activeTab === 'unread' ? 'Tuyệt vời! 🎉' : 'Chưa có thông báo'}
                        </h3>
                        <p className="text-xs text-gray-400 text-center max-w-[200px]">
                            {activeTab === 'unread'
                                ? 'Bạn đã đọc tất cả thông báo.'
                                : 'Thông báo mới sẽ xuất hiện ở đây.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {grouped.map(group => (
                            <div key={group.label}>
                                {/* Date group header */}
                                <div className="flex items-center gap-2 px-1 mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{group.label}</span>
                                    <div className="flex-1 h-px bg-gray-200" />
                                </div>

                                {/* Notification cards */}
                                <div className="flex flex-col gap-1.5">
                                    {group.items.map((notification) => {
                                        const config = getTypeConfig(notification.type);
                                        const hasLink = !!notification.actionLink;
                                        const isExpanded = expandedId === notification.id;

                                        return (
                                            <div
                                                key={notification.id}
                                                className={cn(
                                                    'w-full text-left rounded-2xl transition-all relative overflow-hidden',
                                                    !notification.isRead
                                                        ? 'bg-white border border-primary-100 shadow-sm'
                                                        : 'bg-white/60 border border-gray-100',
                                                    isExpanded && 'border-primary-200 shadow-md',
                                                )}
                                            >
                                                {/* Main card — tappable */}
                                                <button
                                                    onClick={() => handleNotificationClick(notification)}
                                                    className="w-full text-left flex gap-3 p-3.5 active:bg-gray-50/50 transition-colors"
                                                >
                                                    {/* Unread dot */}
                                                    {!notification.isRead && (
                                                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary-500" />
                                                    )}

                                                    {/* Type icon */}
                                                    <div className={cn(
                                                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                                        config.bgColor,
                                                    )}>
                                                        {config.icon}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <p className={cn(
                                                            'text-[13px] leading-snug',
                                                            !notification.isRead
                                                                ? 'font-bold text-gray-900'
                                                                : 'font-medium text-gray-600'
                                                        )}>
                                                            {notification.title}
                                                        </p>
                                                        <p className={cn(
                                                            'text-[11px] text-gray-400 mt-1 leading-relaxed',
                                                            !isExpanded && 'line-clamp-2'
                                                        )}>
                                                            {notification.body}
                                                        </p>
                                                        <p className="text-[10px] text-gray-300 mt-1.5 font-medium">
                                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: vi })}
                                                        </p>
                                                    </div>
                                                </button>

                                                {/* Expanded action area */}
                                                {isExpanded && hasLink && (
                                                    <div className="px-3.5 pb-3 pt-0 pl-[62px]">
                                                        <button
                                                            onClick={() => router.push(notification.actionLink!)}
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-50 text-primary-600 text-xs font-bold active:scale-95 transition-all"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            Xem chi tiết
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* ── Hidden Debug Panel — triple-tap 🐛 icon to reveal ── */}
            {showDebug && (
                <div className="animate-in slide-in-from-bottom-4 duration-300 border-t-2 border-dashed border-gray-200 bg-gray-50 pb-safe">
                    <div className="flex items-center gap-2 px-4 py-2">
                        <Bug className="w-3.5 h-3.5 text-gray-400" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Push Debug Mode</p>
                        <button onClick={() => setShowDebug(false)} className="ml-auto text-[10px] text-gray-400 underline">Ẩn</button>
                    </div>
                    <PushDebugPanel inline />
                </div>
            )}
        </div>
    );
}
