'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { NotificationDoc } from '@/types';
import { Bell, Check, CheckCircle2, ChevronRight, Info, BellOff, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

type FilterTab = 'all' | 'unread';

export default function NotificationsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [markingAll, setMarkingAll] = useState(false);

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

            // Sort descending by createdAt
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
        if (!notification.isRead) {
            try {
                const docRef = doc(db, 'notifications', notification.id);
                await updateDoc(docRef, { isRead: true });
            } catch (error) {
                console.error("Error updating notification status:", error);
            }
        }

        if (notification.actionLink) {
            router.push(notification.actionLink);
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
            icon: <Info className="w-5 h-5 text-primary-600" />,
            bgColor: 'bg-primary-100',
            borderColor: 'border-primary-200',
        },
        SWAP_REQUEST: {
            icon: <ChevronRight className="w-5 h-5 text-warning-600" />,
            bgColor: 'bg-warning-100',
            borderColor: 'border-warning-200',
        },
        APPROVAL: {
            icon: <CheckCircle2 className="w-5 h-5 text-success-600" />,
            bgColor: 'bg-success-100',
            borderColor: 'border-success-200',
        },
        GENERAL: {
            icon: <Bell className="w-5 h-5 text-surface-500" />,
            bgColor: 'bg-surface-100',
            borderColor: 'border-surface-200',
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
        <div className="space-y-6 mx-auto max-w-3xl">
            {/* Page Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Bell className="w-7 h-7 text-primary-600" />
                                Thông báo
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm flex items-center gap-2">
                                Xem và quản lý thông báo của bạn.
                                {unreadCount > 0 && (
                                    <span className="bg-danger-50 text-danger-600 text-xs font-bold px-2 py-0.5 rounded-full border border-danger-200">
                                        {unreadCount} chưa đọc
                                    </span>
                                )}
                            </p>
                        </div>

                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                disabled={markingAll}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 active:scale-95"
                            >
                                {markingAll ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                Đọc tất cả
                            </button>
                        )}
                    </div>
                }
            />

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-1 flex gap-1">
                <button
                    onClick={() => setActiveTab('all')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                        activeTab === 'all'
                            ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-sm'
                            : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50'
                    )}
                >
                    Tất cả
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-bold",
                        activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500'
                    )}>
                        {notifications.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('unread')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                        activeTab === 'unread'
                            ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-sm'
                            : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50'
                    )}
                >
                    Chưa đọc
                    {unreadCount > 0 && (
                        <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-bold",
                            activeTab === 'unread' ? 'bg-white/20 text-white' : 'bg-danger-100 text-danger-600'
                        )}>
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Notifications List */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-16 text-center flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm text-surface-400">Đang tải thông báo...</p>
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-16 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-surface-100 to-surface-50 rounded-3xl flex items-center justify-center mb-5 border border-surface-200">
                        {activeTab === 'unread' ? (
                            <Sparkles className="w-9 h-9 text-success-400" />
                        ) : (
                            <BellOff className="w-9 h-9 text-surface-300" />
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-surface-700 mb-1">
                        {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                    </h3>
                    <p className="text-sm text-surface-400 max-w-xs">
                        {activeTab === 'unread'
                            ? 'Tuyệt vời! Bạn đã đọc tất cả thông báo. 🎉'
                            : 'Thông báo mới sẽ hiển thị ở đây khi có cập nhật.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {grouped.map(group => (
                        <div key={group.label}>
                            {/* Date group header */}
                            <div className="flex items-center gap-3 px-1 mb-2">
                                <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">{group.label}</span>
                                <div className="flex-1 h-px bg-surface-200" />
                                <span className="text-[10px] font-medium text-surface-400">{group.items.length} thông báo</span>
                            </div>

                            {/* Notification cards */}
                            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden divide-y divide-surface-100">
                                {group.items.map((notification) => {
                                    const config = getTypeConfig(notification.type);
                                    const hasLink = !!notification.actionLink;

                                    return (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={cn(
                                                "w-full text-left p-4 md:p-5 transition-all flex gap-4 group relative",
                                                !notification.isRead
                                                    ? 'bg-primary-50/40 hover:bg-primary-50/70'
                                                    : 'hover:bg-surface-50/80',
                                                hasLink && 'cursor-pointer'
                                            )}
                                        >
                                            {/* Unread indicator bar */}
                                            {!notification.isRead && (
                                                <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary-500 rounded-r-full" />
                                            )}

                                            {/* Type icon */}
                                            <div className={cn(
                                                'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-shadow',
                                                config.bgColor,
                                                config.borderColor,
                                                !notification.isRead && 'shadow-sm'
                                            )}>
                                                {config.icon}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className={cn(
                                                        "text-sm leading-snug",
                                                        !notification.isRead
                                                            ? 'font-bold text-surface-900'
                                                            : 'font-medium text-surface-700'
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-[11px] text-surface-400 font-medium shrink-0 mt-0.5">
                                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: vi })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-surface-500 mt-1.5 line-clamp-2 leading-relaxed">
                                                    {notification.body}
                                                </p>

                                                {/* Action link hint */}
                                                {hasLink && (
                                                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span>Xem chi tiết</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
