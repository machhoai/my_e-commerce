'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);

    useEffect(() => {
        // Lắng nghe sự kiện beforeinstallprompt
        const handleBeforeInstallPrompt = (e: any) => {
            // Ngăn chặn Chrome hiển thị mini-infobar tự động
            e.preventDefault();
            // Lưu lại event để kích hoạt sau
            setDeferredPrompt(e);
            // Hiển thị nút cài đặt UI của riêng mình
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Phát hiện nếu app đã được cài đặt thành công
        window.addEventListener('appinstalled', () => {
            setShowInstallPrompt(false);
            setDeferredPrompt(null);
            console.log('PWA đã được cài đặt');
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Hiển thị prompt cài đặt mặc định của trình duyệt
        deferredPrompt.prompt();

        // Chờ kết quả người dùng chọn (chấp nhận hay từ chối)
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User choice code: ${outcome}`);

        // Đặt lại prompt
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    if (!showInstallPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-xl shadow-2xl border border-blue-100 p-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-sm">Trải nghiệm mượt mà hơn</h3>
                    <p className="text-xs text-slate-500 mt-1">Cài đặt ứng dụng Lịch Làm Việc vào máy để sử dụng nhanh chóng và nhận thông báo.</p>
                </div>
                <button
                    onClick={() => setShowInstallPrompt(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <button
                onClick={handleInstallClick}
                className="w-full mt-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
            >
                <Download className="w-4 h-4" />
                Cài đặt ứng dụng ngay
            </button>
        </div>
    );
}
