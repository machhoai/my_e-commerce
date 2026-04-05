'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

// ── BeforeInstallPromptEvent (not in TS stdlib) ───────────────────────────────
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
}
declare global {
    interface WindowEventMap { beforeinstallprompt: BeforeInstallPromptEvent; }
}

type OS = 'ios' | 'android' | 'other';
interface GatekeeperState { checked: boolean; shouldBlock: boolean; os: OS; }

function detectOS(ua: string): OS {
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'other';
}
function detectMobile(ua: string): boolean {
    return /iphone|ipad|ipod|android|mobile|tablet/i.test(ua);
}
function isStandalone(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true
    );
}

// ── Step Item ────────────────────────────────────────────────────────────────
function Step({ n, text }: { n: number; text: string }) {
    return (
        <div className="flex items-start gap-3">
            <div
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-md"
                style={{ background: 'linear-gradient(135deg, #FF7900, #FFD100)', color: '#1a1a1a' }}
            >
                {n}
            </div>
            <p className="text-sm leading-relaxed pt-0.5" style={{ color: '#5C4813' }}>{text}</p>
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PWAGatekeeper({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<GatekeeperState>({ checked: false, shouldBlock: false, os: 'other' });
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installing, setInstalling] = useState(false);
    const guideRef = useRef<HTMLDivElement>(null);

    // Client-side detection
    useEffect(() => {
        const ua = navigator.userAgent;
        setState({
            checked: true,
            shouldBlock: detectMobile(ua) && !isStandalone(),
            os: detectOS(ua),
        });
    }, []);

    // Android: capture install prompt
    useEffect(() => {
        if (!state.shouldBlock || state.os !== 'android') return;
        const handler = (e: BeforeInstallPromptEvent) => { e.preventDefault(); setDeferredPrompt(e); };
        const onInstalled = () => setState(p => ({ ...p, shouldBlock: false }));
        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, [state.shouldBlock, state.os]);

    const handleInstall = async () => {
        if (!deferredPrompt) { guideRef.current?.scrollIntoView({ behavior: 'smooth' }); return; }
        setInstalling(true);
        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setState(p => ({ ...p, shouldBlock: false }));
        } finally { setInstalling(false); setDeferredPrompt(null); }
    };

    const scrollToGuide = () => guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Still detecting → blank screen (no hydration flash)
    if (!state.checked) return <div style={{ minHeight: '100dvh', background: '#FFF9E6' }} />;
    // Desktop or standalone → pass through
    if (!state.shouldBlock) return <>{children}</>;

    const isIOS = state.os === 'ios';

    // ── LOCK SCREEN ──────────────────────────────────────────────────────────
    return (
        <div
            style={{ zIndex: 99999, minHeight: '100dvh', background: 'linear-gradient(180deg, #FFF9E6 0%, #FFFBF0 100%)' }}
            className="fixed inset-0 overflow-y-auto flex flex-col"
        >
            {/* ── Status bar area (iOS notch safe area) */}
            <div style={{ height: 'env(safe-area-inset-top, 0px)', background: '#FFD100' }} />

            {/* ── Top bar — mimics a native app header */}
            <div
                className="w-full px-5 py-3 flex items-center gap-3 shadow-sm"
                style={{ background: '#FFD100', borderBottom: '1.5px solid rgba(0,0,0,0.06)' }}
            >
                <div className="relative w-9 h-9">
                    <Image src="/bduck.png" alt="B.Duck" fill className="object-contain drop-shadow" />
                </div>
                <div>
                    <p className="text-xs font-black uppercase tracking-widest leading-none" style={{ color: '#7A4A00' }}>B.Duck Cityfuns</p>
                    <p className="text-[10px] font-semibold leading-none mt-0.5" style={{ color: '#9B6400' }}>Hệ thống nội bộ</p>
                </div>
            </div>

            {/* ── Hero section */}
            <div
                className="w-full flex flex-col items-center text-center px-6 pt-8 pb-6"
                style={{ background: 'linear-gradient(180deg, #FFD100 0%, #FFDD40 50%, #FFF9E6 100%)' }}
            >
                {/* Duck mascot illustration area */}
                <div className="relative mb-4">
                    {/* Glow ring */}
                    <div
                        className="absolute -inset-3 rounded-full opacity-30 blur-xl"
                        style={{ background: 'radial-gradient(circle, #FF7900 0%, transparent 70%)' }}
                    />
                    <div
                        className="relative w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl"
                        style={{
                            background: 'linear-gradient(135deg, #fff 0%, #FFF9E6 100%)',
                            boxShadow: '0 20px 40px rgba(255, 121, 0, 0.25), 0 0 0 4px rgba(255,209,0,0.4)',
                        }}
                    >
                        <div className="relative w-20 h-20">
                            <Image src="/bduck.png" alt="B.Duck" fill className="object-contain drop-shadow-lg" />
                        </div>
                    </div>
                    {/* Notification badge */}
                    <div
                        className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex flex-col items-center justify-center shadow-lg"
                        style={{ background: '#FF7900', border: '2.5px solid #FFF9E6' }}
                    >
                        <span className="text-white text-[8px] font-black leading-none">CÀI</span>
                        <span className="text-white text-[8px] font-black leading-none">ĐẶT</span>
                    </div>
                </div>

                <h1
                    className="text-2xl font-black leading-tight tracking-tight"
                    style={{ color: '#3D2200', textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
                >
                    Cần cài đặt<br />Ứng dụng
                </h1>
                <p className="mt-2 text-sm font-medium leading-relaxed max-w-xs" style={{ color: '#7A4A00' }}>
                    Để nhận thông báo và sử dụng tốc độ tối đa, vui lòng cài đặt ứng dụng vào màn hình chính.
                </p>
            </div>

            {/* ── Benefits — native pill chips */}
            <div className="px-5 -mt-3 flex flex-col gap-3">
                {[
                    { emoji: '⚡', title: 'Tải nhanh hơn 10 lần', sub: 'Không cần tải lại trang mỗi lần mở' },
                    { emoji: '🔔', title: 'Nhận thông báo ca làm', sub: 'Lịch được cập nhật ngay trên màn hình' },
                    { emoji: '🔒', title: 'Truy cập an toàn', sub: 'Đăng nhập một lần, không cần nhớ link' },
                ].map((b, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-3 rounded-2xl px-4 py-3"
                        style={{
                            background: 'rgba(255,255,255,0.9)',
                            border: '1.5px solid rgba(255,209,0,0.4)',
                            boxShadow: '0 2px 8px rgba(255,121,0,0.07)',
                        }}
                    >
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: 'linear-gradient(135deg,#FFF3CC,#FFE580)' }}
                        >
                            {b.emoji}
                        </div>
                        <div>
                            <p className="text-sm font-bold leading-none" style={{ color: '#3D2200' }}>{b.title}</p>
                            <p className="text-xs font-medium mt-0.5" style={{ color: '#9B7040' }}>{b.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── CTA Button */}
            <div className="px-5 mt-5">
                {isIOS ? (
                    <button
                        onClick={scrollToGuide}
                        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black tracking-wide active:scale-95 transition-transform"
                        style={{
                            background: 'linear-gradient(135deg, #FF7900 0%, #FF9500 100%)',
                            color: '#fff',
                            boxShadow: '0 8px 24px rgba(255,121,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                        }}
                    >
                        <span className="text-xl">⬇</span>
                        Xem hướng dẫn cài đặt
                    </button>
                ) : (
                    <button
                        onClick={handleInstall}
                        disabled={installing}
                        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black tracking-wide active:scale-95 transition-transform disabled:opacity-60"
                        style={{
                            background: 'linear-gradient(135deg, #FF7900 0%, #FF9500 100%)',
                            color: '#fff',
                            boxShadow: '0 8px 24px rgba(255,121,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                        }}
                    >
                        {installing
                            ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <span className="text-xl">📲</span>
                        }
                        {installing ? 'Đang cài đặt...' : deferredPrompt ? 'Cài đặt Ứng dụng ngay' : 'Xem hướng dẫn cài đặt'}
                    </button>
                )}

                {/* Android fallback link */}
                {!isIOS && !deferredPrompt && !installing && (
                    <button
                        onClick={scrollToGuide}
                        className="w-full text-center text-xs font-semibold mt-2 py-1 active:opacity-60"
                        style={{ color: '#9B7040' }}
                    >
                        Hoặc cài thủ công — xem hướng dẫn ↓
                    </button>
                )}
            </div>

            {/* ── Divider */}
            <div className="flex items-center gap-3 px-8 mt-7 mb-1">
                <div className="flex-1 h-px" style={{ background: 'rgba(180,120,0,0.15)' }} />
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#C89040' }}>
                    Hướng dẫn từng bước
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(180,120,0,0.15)' }} />
            </div>

            {/* ── Guide section */}
            <div ref={guideRef} className="px-5 mt-4 flex flex-col gap-4 scroll-mt-4 pb-10">

                {/* Steps */}
                <div
                    className="rounded-3xl p-5 flex flex-col gap-4"
                    style={{ background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(255,209,0,0.35)', boxShadow: '0 4px 16px rgba(255,121,0,0.08)' }}
                >
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#C89040' }}>
                        {isIOS ? '📱 Safari / iOS' : '🤖 Chrome / Android'}
                    </p>

                    {isIOS ? (
                        <>
                            <Step n={1} text="Bấm vào biểu tượng Chia sẻ (hình hộp có mũi tên ↑) ở thanh dưới Safari." />
                            <Step n={2} text='Cuộn danh sách xuống và chọn "Thêm vào MH Chính" (Add to Home Screen).' />
                            <Step n={3} text='Bấm "Thêm" (Add) ở góc trên bên phải để hoàn tất.' />
                        </>
                    ) : (
                        <>
                            <Step n={1} text='Bấm nút "Cài đặt Ứng dụng ngay" ở trên nếu xuất hiện.' />
                            <Step n={2} text="Hoặc: Bấm dấu 3 chấm (⋮) ở góc phải trên Chrome." />
                            <Step n={3} text='"Thêm vào Màn hình chính" → "Thêm" để hoàn tất.' />
                        </>
                    )}
                </div>

                {/* GIF demo */}
                <div
                    className="rounded-3xl overflow-hidden flex flex-col items-center"
                    style={{ border: '2px solid rgba(255,209,0,0.5)', boxShadow: '0 8px 24px rgba(255,121,0,0.12)' }}
                >
                    {/* GIF header bar */}
                    <div
                        className="w-full flex items-center justify-between px-4 py-2.5"
                        style={{ background: '#FFD100', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                    >
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                        </div>
                        <span className="text-[10px] font-bold" style={{ color: '#7A4A00' }}>
                            {isIOS ? 'Safari · iOS' : 'Chrome · Android'}
                        </span>
                        <div className="w-10" />
                    </div>

                    <Image
                        src={isIOS ? '/gifs/install-ios.gif' : '/gifs/install-android.gif'}
                        alt={isIOS ? 'Hướng dẫn cài đặt iOS' : 'Hướng dẫn cài đặt Android'}
                        width={380}
                        height={640}
                        unoptimized
                        className="w-full h-auto object-cover"
                        style={{ background: '#f9f9f9' }}
                    />
                </div>

                {/* Tip */}
                <div
                    className="flex items-start gap-3 rounded-2xl px-4 py-3"
                    style={{ background: 'rgba(255,209,0,0.15)', border: '1.5px solid rgba(255,209,0,0.4)' }}
                >
                    <span className="text-xl shrink-0">💡</span>
                    <p className="text-xs font-medium leading-relaxed" style={{ color: '#7A4A00' }}>
                        Sau khi cài đặt, hãy <strong>mở lại ứng dụng từ màn hình chính</strong> thay vì từ trình duyệt nhé!
                    </p>
                </div>

                {/* Bottom safe area */}
                <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
            </div>
        </div>
    );
}
