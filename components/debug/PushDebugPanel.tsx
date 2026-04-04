'use client';

import { useState, useEffect } from 'react';
import { requestFirebaseNotificationPermission } from '@/lib/firebase-messaging';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
    Bell, CheckCircle2, XCircle, AlertTriangle,
    ChevronDown, ChevronUp, RefreshCw, Send, Copy, Check
} from 'lucide-react';

type StatusLine = {
    type: 'ok' | 'warn' | 'error' | 'info';
    label: string;
    value: string;
};

type TestResult = {
    success: boolean;
    messageId?: string;
    error?: string;
    code?: string;
    sentAt?: string;
};

export function PushDebugPanel({ inline = false }: { inline?: boolean }) {
    const { user } = useAuth();
    const [open, setOpen] = useState(inline); // inline mode starts open
    const [loading, setLoading] = useState(false);
    const [diagLoading, setDiagLoading] = useState(false);
    const [status, setStatus] = useState<StatusLine[]>([]);
    const [currentToken, setCurrentToken] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [copied, setCopied] = useState(false);
    // Track permission as state — avoids SSR crash (Notification is browser-only)
    const [permission, setPermission] = useState<NotificationPermission | null>(null);

    // Read permission only on client after mount
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const runDiagnostics = async () => {
        setDiagLoading(true);
        setTestResult(null);
        const lines: StatusLine[] = [];

        // ── 1. Check platform ────────────────────────────────────────────
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        const isAndroid = /Android/.test(ua);
        const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
        const isStandalone = (window.navigator as any).standalone === true
            || window.matchMedia('(display-mode: standalone)').matches;

        lines.push({
            type: 'info',
            label: 'Thiết bị',
            value: isIOS ? `iOS (Safari: ${isSafari}) — Standalone PWA: ${isStandalone}` :
                isAndroid ? 'Android' : 'Desktop/Other',
        });

        if (isIOS && !isStandalone) {
            lines.push({
                type: 'error',
                label: '⚠️ Chưa Add to Home Screen',
                value: 'iOS chỉ hỗ trợ Web Push khi app được mở từ màn hình Home (Add to Home Screen). Hãy thêm vào Home Screen trước.',
            });
        }

        // ── 2. Check Notification API ────────────────────────────────────
        if (!('Notification' in window)) {
            lines.push({ type: 'error', label: 'Notification API', value: 'KHÔNG HỖ TRỢ — Trình duyệt/thiết bị của bạn không có Web Notification API.' });
            setStatus(lines);
            setDiagLoading(false);
            return;
        }

        const perm = (typeof window !== 'undefined' && 'Notification' in window)
            ? Notification.permission
            : 'default';
        setPermission(perm);
        lines.push({
            type: perm === 'granted' ? 'ok' : perm === 'denied' ? 'error' : 'warn',
            label: 'Notification.permission',
            value: perm === 'granted' ? '✅ granted — Đã cấp quyền'
                : perm === 'denied' ? '❌ denied — Đã từ chối (cần vào Settings để bật lại)'
                    : '⚠️ default — Chưa cấp quyền (cần bấm Xin quyền)',
        });

        // ── 3. Check Service Worker ──────────────────────────────────────
        if (!('serviceWorker' in navigator)) {
            lines.push({ type: 'error', label: 'Service Worker', value: 'KHÔNG HỖ TRỢ' });
            setStatus(lines);
            setDiagLoading(false);
            return;
        }

        try {
            // Race serviceWorker.ready against a 5-second timeout
            // to avoid hanging forever when the SW is not installed
            const swReadyTimeout = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('SW ready timeout after 5s')), 5000)
            );
            const swReg = await Promise.race([
                navigator.serviceWorker.ready,
                swReadyTimeout,
            ]) as ServiceWorkerRegistration;
            const swState = swReg.active?.state || 'unknown';
            const swScope = swReg.scope;
            lines.push({
                type: swState === 'activated' ? 'ok' : 'warn',
                label: 'Service Worker',
                value: `${swState === 'activated' ? '✅' : '⚠️'} State: ${swState} | Scope: ${swScope}`,
            });
        } catch {
            lines.push({ type: 'error', label: 'Service Worker', value: '❌ Không active — SW chưa được đăng ký. Kiểm tra next.config.ts disable: false' });
        }

        // ── 4. VAPID Key ─────────────────────────────────────────────────
        const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        lines.push({
            type: vapid ? 'ok' : 'error',
            label: 'VAPID Key',
            value: vapid
                ? `✅ Có (${vapid.substring(0, 12)}...${vapid.substring(vapid.length - 4)})`
                : '❌ THIẾU — NEXT_PUBLIC_FIREBASE_VAPID_KEY chưa được set trong .env',
        });

        // ── 5. FCM Token ─────────────────────────────────────────────────
        if (perm === 'granted') {
            try {
                const token = await requestFirebaseNotificationPermission();
                if (token) {
                    setCurrentToken(token);
                    lines.push({
                        type: 'ok',
                        label: 'FCM Token',
                        value: `✅ Có token (${token.substring(0, 20)}...${token.substring(token.length - 10)})`,
                    });
                } else {
                    lines.push({
                        type: 'error',
                        label: 'FCM Token',
                        value: '❌ Không lấy được token — Kiểm tra VAPID key và SW registration',
                    });
                }
            } catch (e) {
                lines.push({
                    type: 'error',
                    label: 'FCM Token',
                    value: `❌ Lỗi: ${String(e)}`,
                });
            }
        } else {
            lines.push({ type: 'warn', label: 'FCM Token', value: '— Chưa có quyền, không thể lấy token' });
        }

        setStatus(lines);
        setDiagLoading(false);
    };

    const requestPermission = async () => {
        setLoading(true);
        const token = await requestFirebaseNotificationPermission();
        if (token) {
            setCurrentToken(token);
            if ('Notification' in window) setPermission(Notification.permission);
            await runDiagnostics();
        }
        setLoading(false);
    };

    const sendTestPush = async () => {
        if (!currentToken) {
            alert('Chưa có FCM token. Click "Chạy chẩn đoán" trước.');
            return;
        }
        setLoading(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/debug/push-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: currentToken }),
            });
            const data = await res.json();
            setTestResult(data);
        } catch (e) {
            setTestResult({ success: false, error: String(e) });
        }
        setLoading(false);
    };

    const copyToken = () => {
        if (!currentToken) return;
        navigator.clipboard.writeText(currentToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const iconFor = (type: StatusLine['type']) => {
        if (type === 'ok') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />;
        if (type === 'error') return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />;
        if (type === 'warn') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />;
        return <Bell className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />;
    };

    const bgFor = (type: StatusLine['type']) => {
        if (type === 'ok') return 'bg-emerald-50 border-emerald-100';
        if (type === 'error') return 'bg-red-50 border-red-100';
        if (type === 'warn') return 'bg-amber-50 border-amber-100';
        return 'bg-blue-50 border-blue-100';
    };

    // -- Inline mode: render panel content directly (no fixed wrapper/toggle) --
    if (inline) {
        return (
            <div className="px-3 py-3">
                {/* Diagnostic status lines */}
                <div className="flex flex-col gap-1.5 mb-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Chẩn đoán</p>
                        <button onClick={runDiagnostics} disabled={diagLoading}
                            className="flex items-center gap-1 text-[10px] text-primary-600 font-bold disabled:opacity-50">
                            <RefreshCw className={cn('w-3 h-3', diagLoading && 'animate-spin')} />
                            Làm mới
                        </button>
                    </div>
                    {diagLoading ? (
                        <div className="flex items-center gap-2 py-3 justify-center">
                            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-gray-400">Đang kiểm tra...</p>
                        </div>
                    ) : status.length === 0 ? (
                        <p className="text-[11px] text-gray-400 py-2 text-center">Bấm “Làm mới” để bắt đầu kiểm tra</p>
                    ) : (
                        status.map((s, i) => (
                            <div key={i} className={cn('flex gap-2 rounded-xl p-2 border text-[11px]', bgFor(s.type))}>
                                {iconFor(s.type)}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-700">{s.label}</p>
                                    <p className="text-gray-500 leading-relaxed break-words">{s.value}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {/* Token */}
                {currentToken && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100 mb-3">
                        <p className="flex-1 text-[9px] text-gray-400 font-mono truncate">{currentToken}</p>
                        <button onClick={copyToken} className="shrink-0 p-1">
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                    </div>
                )}
                {/* Test result */}
                {testResult && (
                    <div className={cn('p-2.5 rounded-xl border text-[11px] mb-3',
                        testResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
                        {testResult.success ? (
                            <><p className="font-bold text-emerald-700">✅ Gửi thành công!</p><p className="text-emerald-500 mt-0.5">ID: {testResult.messageId?.slice(-12)}</p></>
                        ) : (
                            <><p className="font-bold text-red-700">❌ Gửi thất bại</p><p className="text-red-600 mt-0.5">{testResult.error}</p></>
                        )}
                    </div>
                )}
                {/* Actions */}
                <div className="flex gap-2">
                    {permission !== 'granted' && (
                        <button onClick={requestPermission} disabled={loading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-50">
                            <Bell className="w-3.5 h-3.5" /> Xin quyền
                        </button>
                    )}
                    <button onClick={sendTestPush} disabled={loading || !currentToken}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-50',
                            currentToken ? 'bg-primary-600' : 'bg-gray-300')}>
                        {loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Test iOS Push
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-20 right-3 z-50 w-[calc(100vw-24px)] max-w-sm">
            {/* Toggle button */}
            <button
                onClick={() => {
                    setOpen(o => !o);
                    if (!open && status.length === 0) runDiagnostics();
                }}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold shadow-xl active:scale-95 transition-transform"
            >
                <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Push Debug Panel
                </div>
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {/* Panel */}
            {open && (
                <div className="mt-2 rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
                    {/* Status lines */}
                    <div className="p-3 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Chẩn đoán</p>
                            <button
                                onClick={runDiagnostics}
                                disabled={diagLoading}
                                className="flex items-center gap-1 text-[10px] text-primary-600 font-bold disabled:opacity-50"
                            >
                                <RefreshCw className={cn('w-3 h-3', diagLoading && 'animate-spin')} />
                                Làm mới
                            </button>
                        </div>

                        {diagLoading ? (
                            <div className="flex items-center gap-2 py-3 justify-center">
                                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-xs text-gray-400">Đang kiểm tra...</p>
                            </div>
                        ) : status.length === 0 ? (
                            <p className="text-[11px] text-gray-400 py-2 text-center">Bấm "Làm mới" để bắt đầu kiểm tra</p>
                        ) : (
                            status.map((s, i) => (
                                <div key={i} className={cn('flex gap-2 rounded-xl p-2 border text-[11px]', bgFor(s.type))}>
                                    {iconFor(s.type)}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-700">{s.label}</p>
                                        <p className="text-gray-500 leading-relaxed break-words">{s.value}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Token display */}
                    {currentToken && (
                        <div className="px-3 pb-2">
                            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="flex-1 text-[9px] text-gray-400 font-mono truncate">{currentToken}</p>
                                <button onClick={copyToken} className="shrink-0 p-1 rounded-lg active:bg-gray-200 transition-colors">
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Test result */}
                    {testResult && (
                        <div className={cn(
                            'mx-3 mb-2 p-2.5 rounded-xl border text-[11px]',
                            testResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                        )}>
                            {testResult.success ? (
                                <>
                                    <p className="font-bold text-emerald-700">✅ Gửi thành công!</p>
                                    <p className="text-emerald-600 mt-0.5">Message ID: {testResult.messageId?.slice(-12)}</p>
                                    <p className="text-emerald-500 mt-0.5">Nếu iOS không hiển thị trong 5 giây → vấn đề ở APNs/iOS Settings.</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-bold text-red-700">❌ Gửi thất bại</p>
                                    <p className="text-red-600 mt-0.5">{testResult.error}</p>
                                    {testResult.code && <p className="text-red-500 mt-0.5">Code: {testResult.code}</p>}
                                </>
                            )}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="p-3 pt-0 flex gap-2">
                        {permission !== 'granted' && (
                            <button
                                onClick={requestPermission}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
                            >
                                <Bell className="w-3.5 h-3.5" />
                                Xin quyền
                            </button>
                        )}
                        <button
                            onClick={sendTestPush}
                            disabled={loading || !currentToken}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-50',
                                currentToken ? 'bg-primary-600' : 'bg-gray-300'
                            )}
                        >
                            {loading ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                            Test iOS Push
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
