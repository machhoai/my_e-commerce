'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import AuthGuard from '@/components/layout/AuthGuard';
import ProfileCompletionGuard from '@/components/auth/ProfileCompletionGuard';
import UniversalScannerModal from '@/components/scanner/UniversalScannerModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function MobileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Auth pages (login, change-password) should NOT be wrapped in AuthGuard
    const isAuthPage = pathname === '/login' || pathname === '/change-password';

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <AuthGuard>
            <ProfileCompletionGuard>
                <MobileLayoutInner>{children}</MobileLayoutInner>
            </ProfileCompletionGuard>
        </AuthGuard>
    );
}

/** Inner component so hooks run only for authenticated users (inside AuthGuard) */
function MobileLayoutInner({ children }: { children: React.ReactNode }) {
    // Initialize Push Notifications — request permission & register FCM token.
    // On desktop this lives inside DashboardLayout; mobile needs its own call.
    const { needsPrompt, promptForPermission } = usePushNotifications();
    const [dismissed, setDismissed] = useState(false);

    const showBanner = needsPrompt && !dismissed;

    return (
        <div className="no-scrollbar">
            {/* iOS-compatible notification permission banner.
                iOS PWA requires Notification.requestPermission() to be called
                from a direct user gesture (tap). We cannot auto-prompt. */}
            {showBanner && (
                <div className="fixed top-0 left-0 right-0 z-[60] animate-in slide-in-from-top-2 duration-300">
                    <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-r from-accent-500 to-accent-600 p-4 shadow-xl shadow-accent-500/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                <Bell className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white">Bật thông báo</p>
                                <p className="text-xs text-white/80 mt-0.5 leading-relaxed">
                                    Nhận thông báo lịch làm, đơn hàng và tin quan trọng ngay trên điện thoại.
                                </p>
                                <div className="flex items-center gap-2 mt-3">
                                    <button
                                        onClick={async () => {
                                            await promptForPermission();
                                        }}
                                        className="px-4 py-2 rounded-xl bg-white text-accent-600 text-xs font-bold
                                                   hover:bg-white/90 active:scale-95 transition-all shadow-sm"
                                    >
                                        Cho phép thông báo
                                    </button>
                                    <button
                                        onClick={() => setDismissed(true)}
                                        className="px-3 py-2 rounded-xl bg-white/10 text-white/90 text-xs font-medium
                                                   hover:bg-white/20 transition-colors"
                                    >
                                        Để sau
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setDismissed(true)}
                                className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {children}
            {/* Floating QR/Barcode scanner — always accessible on mobile */}
            <UniversalScannerModal />
        </div>
    );
}
