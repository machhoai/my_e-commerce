'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { NotificationDoc } from '@/types';
import { Bell, Check, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function NotificationBell() {
    const { user } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    useEffect(() => {
        if (!user) return;

        // Removing orderBy to avoid requiring a composite index in Firestore. We will sort in JS.
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as NotificationDoc[];

            // Sort descending by createdAt
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setNotifications(data);
        }, (error) => {
            console.error("Lỗi khi lấy thông báo từ Firestore:", error);
        });

        return () => unsubscribe();
    }, [user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

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
            setIsOpen(false);
            router.push(notification.actionLink);
        }
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0 || !user) return;

        try {
            const batch = writeBatch(db);
            const unreadDocs = notifications.filter(n => !n.isRead).slice(0, 500); // Firestore batch limit

            unreadDocs.forEach(n => {
                const docRef = doc(db, 'notifications', n.id);
                batch.update(docRef, { isRead: true });
            });

            await batch.commit();
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'SYSTEM': return <Info className="w-5 h-5 text-blue-500" />;
            case 'SWAP_REQUEST': return <ChevronRight className="w-5 h-5 text-amber-500" />;
            case 'APPROVAL': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            default: return <Bell className="w-5 h-5 text-slate-500" />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Thông báo"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden origin-top-right animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-800">Thông báo</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
                            >
                                <Check className="w-3.5 h-3.5" />
                                Đánh dấu đã đọc
                            </button>
                        )}
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                                <Bell className="w-8 h-8 text-slate-300 mb-2" />
                                <p className="text-sm">Không có thông báo mới.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {notifications.map((notification) => (
                                    <button
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex gap-3 ${!notification.isRead ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className="mt-1 shrink-0">
                                            {getIconForType(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm ${!notification.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                {notification.body}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: vi })}
                                            </p>
                                        </div>
                                        {!notification.isRead && (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 self-center shrink-0"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
