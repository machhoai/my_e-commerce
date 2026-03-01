'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { NotificationDoc } from '@/types';
import { Bell, Check, CheckCircle2, ChevronRight, Info, Calendar, BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

    const getIconForType = (type: string) => {
        switch (type) {
            case 'SYSTEM':
                return (
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <Info className="w-5 h-5 text-blue-600" />
                    </div>
                );
            case 'SWAP_REQUEST':
                return (
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <ChevronRight className="w-5 h-5 text-amber-600" />
                    </div>
                );
            case 'APPROVAL':
                return (
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                );
            default:
                return (
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-slate-500" />
                    </div>
                );
        }
    };

    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(n => !n.isRead)
        : notifications;

    return (
        <div className="space-y-6 mx-auto">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Bell className="w-5 h-5 text-blue-600" />
                        </div>
                        Quản lý Thông báo
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Xem và quản lý tất cả thông báo của bạn.
                    </p>
                </div>

                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        disabled={markingAll}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        {markingAll ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        Đánh dấu tất cả đã đọc
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 flex gap-1">
                <button
                    onClick={() => setActiveTab('all')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                        activeTab === 'all'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    )}
                >
                    Tất cả
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-bold",
                        activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    )}>
                        {notifications.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('unread')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                        activeTab === 'unread'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    )}
                >
                    Chưa đọc
                    {unreadCount > 0 && (
                        <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-bold",
                            activeTab === 'unread' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                        )}>
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Notifications List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center flex flex-col items-center text-slate-500">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                        Đang tải thông báo...
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="p-16 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                            <BellOff className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-600 mb-1">
                            {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                        </h3>
                        <p className="text-sm text-slate-400 max-w-xs">
                            {activeTab === 'unread'
                                ? 'Tuyệt vời! Bạn đã đọc tất cả các thông báo.'
                                : 'Thông báo mới sẽ hiển thị ở đây khi có cập nhật.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredNotifications.map((notification) => (
                            <button
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={cn(
                                    "w-full text-left p-4 md:p-5 hover:bg-slate-50/80 transition-all flex gap-4 group",
                                    !notification.isRead && 'bg-blue-50/40'
                                )}
                            >
                                {getIconForType(notification.type)}

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className={cn(
                                            "text-sm leading-snug",
                                            !notification.isRead
                                                ? 'font-bold text-slate-900'
                                                : 'font-medium text-slate-700'
                                        )}>
                                            {notification.title}
                                        </p>
                                        {!notification.isRead && (
                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5 ring-4 ring-blue-500/10" />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                        {notification.body}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-2 font-medium">
                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: vi })}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
