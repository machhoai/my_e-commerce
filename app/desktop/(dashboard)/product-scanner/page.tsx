'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScanLine, Search, Camera, RotateCcw, Zap, ZapOff, ChevronDown, Loader2, Package, Trash2, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { preloadScannerData, getWmsWarehouseMappingAction, getAvailableWmsWarehousesAction, getMyScansAction, cancelExternalScanAction, submitExternalScanAction, getWmsLocationsAction } from '@/actions/scanner';
import type { PreloadedProduct } from '@/actions/scanner';
import { useAuth } from '@/contexts/AuthContext';

// ── Beep via Web Audio API ───────────────────────────────────────
function playBeep(frequency = 1200, duration = 80, volume = 0.4) {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration / 1000 + 0.05);
        osc.onended = () => ctx.close();
    } catch { /* AudioContext not supported */ }
}

export default function ProductScannerPage() {
    const { user: authUser, userDoc } = useAuth();
    const isAdmin = userDoc?.role === 'super_admin' || userDoc?.role === 'admin';

    // Scanner state
    const [view, setView] = useState<'list' | 'camera'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);

    const scannerRef = useRef<HTMLDivElement>(null);
    const html5QrRef = useRef<any>(null);
    const scanLock = useRef(false);

    // Preloaded data
    const [preloadedProducts, setPreloadedProducts] = useState<PreloadedProduct[]>([]);
    const [preloading, setPreloading] = useState(false);
    const preloadAttempted = useRef(false);

    // Warehouse & Location
    const [wmsWarehouseId, setWmsWarehouseId] = useState<string | null>(null);
    const [availableWarehouses, setAvailableWarehouses] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [loadingLocs, setLoadingLocs] = useState(false);

    const canSelectWarehouse = isAdmin || (!userDoc?.storeId);

    // Queue
    const [queue, setQueue] = useState<any[]>([]);
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    // ── Preload data ──────────────────────────────────────────────
    useEffect(() => {
        if (!authUser) return;
        if (preloadAttempted.current) return;
        let isMounted = true;

        const fetchPreloadData = async () => {
            preloadAttempted.current = true;
            setPreloading(true);
            try {
                let warehouseIdToUse: string | null = null;

                if (!canSelectWarehouse && authUser?.uid && userDoc?.storeId) {
                    const mapRes = await getWmsWarehouseMappingAction(
                        (userDoc.workplaceType as any) || 'STORE',
                        userDoc.storeId
                    );
                    if (mapRes.success && mapRes.wmsWarehouseId) {
                        warehouseIdToUse = mapRes.wmsWarehouseId;
                        if (isMounted) setWmsWarehouseId(warehouseIdToUse);
                    }
                }

                if (canSelectWarehouse) {
                    const whRes = await getAvailableWmsWarehousesAction();
                    if (whRes.success && whRes.data) {
                        if (isMounted) setAvailableWarehouses(whRes.data);
                        if (!warehouseIdToUse && whRes.data.length > 0) {
                            warehouseIdToUse = whRes.data[0].id;
                            if (isMounted) setWmsWarehouseId(warehouseIdToUse);
                        }
                    } else if (whRes.error) {
                        console.error('[ProductScanner] Warehouse API failed:', whRes.error, whRes.apiUrl);
                    }
                }

                const data = await preloadScannerData(warehouseIdToUse || undefined);
                if (isMounted) {
                    setPreloadedProducts(data.products);
                }
            } catch (err) {
                console.error('[ProductScanner] Preload failed:', err);
            } finally {
                if (isMounted) setPreloading(false);
            }
        };

        fetchPreloadData();
        return () => { isMounted = false; };
    }, [authUser, userDoc, canSelectWarehouse]);

    // ── Handle warehouse change ──────────────────────────────────
    const handleWarehouseChange = async (newId: string) => {
        setWmsWarehouseId(newId);
        setPreloading(true);
        try {
            const data = await preloadScannerData(newId);
            setPreloadedProducts(data.products);
        } catch (err) {
            console.error('[ProductScanner] Reload failed:', err);
        } finally {
            setPreloading(false);
        }
        loadQueue();
    };

    // ── Load locations ──────────────────────────────────────────
    useEffect(() => {
        if (wmsWarehouseId) {
            setLoadingLocs(true);
            setSelectedLocationId('');
            getWmsLocationsAction(wmsWarehouseId).then(res => {
                if (res.success && res.data) {
                    setLocations(res.data);
                    if (res.data.length > 0) setSelectedLocationId(res.data[0].id);
                } else if (res.error) {
                    console.error('[ProductScanner] Locations API failed:', res.error);
                }
                setLoadingLocs(false);
            });
        }
    }, [wmsWarehouseId]);

    // ── Load queue ──────────────────────────────────────────────
    const loadQueue = useCallback(async () => {
        if (!authUser?.uid) return;
        setLoadingQueue(true);
        try {
            const result = await getMyScansAction(authUser.uid);
            if (result.success) {
                setQueue(result.data || []);
            } else if (result.error) {
                console.error('[ProductScanner] Queue API failed:', result.error);
            }
        } catch (err) {
            console.error('[ProductScanner] Queue load failed:', err);
        } finally {
            setLoadingQueue(false);
        }
    }, [authUser?.uid]);

    useEffect(() => { loadQueue(); }, [loadQueue]);

    // ── Cancel a queued item ────────────────────────────────────
    const handleCancel = async (scanId: string) => {
        setCancellingId(scanId);
        try {
            const result = await cancelExternalScanAction(scanId);
            if (result.success) {
                setQueue(prev => prev.filter(item => item.id !== scanId));
            }
        } catch (err) {
            console.error('[ProductScanner] Cancel failed:', err);
        } finally {
            setCancellingId(null);
        }
    };

    // ── Add product ─────────────────────────────────────────────
    const handleSubmitProduct = async (product: PreloadedProduct) => {
        if (!wmsWarehouseId) return alert('Lỗi: Chưa liên kết với kho WMS nào.');
        if (!selectedLocationId) return alert('Lỗi: Vui lòng chọn vị trí/kệ hàng xuất kho.');
        if (!authUser) return;

        setSubmittingId(product.id);

        try {
            const result = await submitExternalScanAction({
                warehouse_id: wmsWarehouseId,
                barcode: product.barcode || '',
                product_id: product.id,
                warehouse_location_id: selectedLocationId,
                quantity: 1, // Add immediately 1 item
                operator_name: authUser.displayName || authUser.email || 'Unknown',
                operator_id_external: authUser.uid,
                device_id: null,
            });
            if (result.success) {
                playBeep(1800, 100);
                await loadQueue();
            } else {
                alert('Lỗi: ' + (result.messages?.vi || 'Không thể thêm vào WMS'));
            }
        } catch {
            alert('Lỗi hệ thống khi lưu');
        } finally {
            setSubmittingId(null);
            setTimeout(() => { scanLock.current = false; }, 1000);
        }
    };

    // ── Camera setup ────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        if (!scannerRef.current) return;
        scanLock.current = false;
        try {
            const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
            const scanner = new Html5Qrcode('product-scanner-container', {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                ],
                verbose: false,
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
            });
            html5QrRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 30,
                    qrbox: (viewW: number, viewH: number) => ({
                        width: Math.round(viewW * 0.80),
                        height: Math.round(viewH * 0.25),
                    }),
                    disableFlip: true,
                    videoConstraints: {
                        facingMode: { exact: 'environment' },
                        width: { min: 640, ideal: 1920 },
                        height: { min: 480, ideal: 1080 },
                        advanced: [{ focusMode: "continuous" }] as any,
                    },
                },
                (text: string) => {
                    if (scanLock.current) return;
                    scanLock.current = true;

                    const product = preloadedProducts.find(
                        p => p.barcode === text || p.companyCode === text
                    );

                    if (product) {
                        handleSubmitProduct(product);
                    } else {
                        playBeep(300, 300); // error beep
                        alert('Không tìm thấy sản phẩm với mã: ' + text);
                        setTimeout(() => { scanLock.current = false; }, 2000);
                    }
                },
                () => { },
            );
        } catch (err) {
            console.error('Camera init error:', err);
            alert('Không thể khởi động máy ảnh. Vui lòng kiểm tra quyền truy cập.');
            setView('list');
        }
    }, [preloadedProducts, selectedLocationId, wmsWarehouseId]); // add deps

    const stopCamera = useCallback(async () => {
        try {
            if (html5QrRef.current) {
                const state = html5QrRef.current.getState?.();
                if (state === 2 || state === undefined) await html5QrRef.current.stop();
                html5QrRef.current.clear?.();
                html5QrRef.current = null;
            }
        } catch {
            html5QrRef.current = null;
        }
    }, []);

    const toggleTorch = useCallback(async () => {
        try {
            const video = document.querySelector<HTMLVideoElement>('#product-scanner-container video');
            const track = video?.srcObject instanceof MediaStream
                ? (video.srcObject as MediaStream).getVideoTracks()[0] : null;
            if (!track) return;
            const newState = !torchOn;
            await track.applyConstraints({ advanced: [{ torch: newState } as any] });
            setTorchOn(newState);
        } catch { /* torch not supported */ }
    }, [torchOn]);

    const checkTorchSupport = useCallback(() => {
        const video = document.querySelector<HTMLVideoElement>('#product-scanner-container video');
        const track = video?.srcObject instanceof MediaStream
            ? (video.srcObject as MediaStream).getVideoTracks()[0] : null;
        if (!track) return;
        const caps = track.getCapabilities?.() as any;
        setTorchSupported(!!caps?.torch);
    }, []);

    useEffect(() => {
        if (view === 'camera') {
            const timer = setTimeout(() => {
                startCamera();
                setTimeout(checkTorchSupport, 1200);
            }, 300);
            return () => { clearTimeout(timer); stopCamera(); };
        }
    }, [view, startCamera, stopCamera, checkTorchSupport]);

    // ── Filter products ─────────────────────────────────────────
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return preloadedProducts;
        const q = searchQuery.toLowerCase();
        return preloadedProducts.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q)) ||
            (p.companyCode && p.companyCode.toLowerCase().includes(q))
        );
    }, [preloadedProducts, searchQuery]);

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-md">
                        <ScanLine className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-surface-800">Quét sản phẩm xuất kho</h1>
                        <p className="text-xs text-surface-400">Quét mã vạch hoặc chọn để thêm sản phẩm vào hàng đợi</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
                {/* ── Left: Settings & Products / Camera ────────────────────────────── */}
                <div className="flex-1 flex flex-col gap-3 min-w-0">
                    {/* Settings Panel: Warehouse + Location */}
                    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-3 grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
                        {canSelectWarehouse && availableWarehouses.length > 0 ? (
                            <div>
                                <label className="block text-[11px] font-bold text-surface-500 uppercase mb-1">Kho / Nơi thao tác</label>
                                <div className="relative">
                                    <select
                                        value={wmsWarehouseId || ''}
                                        onChange={(e) => handleWarehouseChange(e.target.value)}
                                        className="w-full appearance-none bg-surface-50 border border-surface-200 text-surface-800 text-sm rounded-xl px-3 py-2.5 focus:ring-accent-500 focus:border-accent-400 outline-none pr-8 font-medium"
                                    >
                                        <option value="" disabled>-- Chọn kho WMS --</option>
                                        {availableWarehouses.map(wh => (
                                            <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-surface-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                        ) : (
                            wmsWarehouseId && (
                                <div>
                                    <label className="block text-[11px] font-bold text-surface-500 uppercase mb-1">Kho liên kết</label>
                                    <div className="bg-surface-50 border border-surface-200 text-surface-800 text-sm rounded-xl px-3 py-2.5 font-medium truncate">
                                        ID: {wmsWarehouseId}
                                    </div>
                                </div>
                            )
                        )}

                        <div>
                            <label className="block text-[11px] font-bold text-surface-500 uppercase mb-1">Vị trí lưu trữ (Kệ)</label>
                            <div className="relative">
                                <select
                                    value={selectedLocationId}
                                    onChange={e => setSelectedLocationId(e.target.value)}
                                    disabled={loadingLocs || locations.length === 0}
                                    className="w-full appearance-none bg-surface-50 border border-surface-200 text-surface-800 text-sm rounded-xl px-3 py-2.5 focus:ring-accent-500 focus:border-accent-400 outline-none pr-8 font-medium disabled:opacity-60"
                                >
                                    {loadingLocs ? <option value="">Đang tải...</option> : locations.length === 0 ? <option value="">Trống</option> : (
                                        locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                                        ))
                                    )}
                                </select>
                                <ChevronDown className="w-4 h-4 text-surface-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Camera / List View */}
                    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[300px]">
                        {view === 'list' ? (
                            <div className="flex flex-col h-full">
                                <div className="p-3 border-b border-surface-100 flex gap-2 shrink-0">
                                    <div className="relative flex-1">
                                        <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Tìm sản phẩm..."
                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-xl pl-9 pr-3 py-2.5 focus:ring-accent-500 focus:border-accent-400 outline-none"
                                        />
                                        {searchQuery && (
                                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <X className="w-4 h-4 text-surface-400" />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setView('camera')}
                                        className="px-4 rounded-xl bg-surface-800 text-white flex items-center justify-center gap-2 hover:bg-surface-900 active:scale-95 transition-transform text-sm font-bold"
                                    >
                                        <Camera className="w-4 h-4" />
                                        <span className="hidden sm:inline">Quét mã</span>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 bg-surface-50 min-h-0">
                                    {preloading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-accent-500" /></div>
                                    ) : filteredProducts.length === 0 ? (
                                        <div className="text-center py-8 text-surface-400 text-sm">Không tìm thấy sản phẩm.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-16">
                                            {filteredProducts.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => handleSubmitProduct(p)}
                                                    disabled={submittingId === p.id}
                                                    className="flex items-center gap-3 p-3 rounded-xl border border-surface-100 hover:border-accent-300 hover:bg-accent-50 active:scale-[0.98] transition-all text-left group"
                                                >
                                                    <div className="w-12 h-12 bg-white rounded-lg border border-surface-100 overflow-hidden flex items-center justify-center shrink-0">
                                                        {p.image ? <img src={p.image} className="w-full h-full object-contain p-1" /> : <Package className="w-6 h-6 text-surface-300" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-xs font-bold text-surface-800 line-clamp-2 group-hover:text-accent-700 transition-colors">{p.name}</h3>
                                                        <p className="text-[10px] text-surface-400 mt-0.5 truncate">{p.barcode || p.companyCode}</p>
                                                    </div>
                                                    {submittingId === p.id ? (
                                                        <Loader2 className="w-5 h-5 animate-spin text-accent-500 shrink-0" />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-200 group-hover:bg-accent-500 group-hover:border-accent-500 flex items-center justify-center shrink-0 transition-colors">
                                                            <Plus className="w-4 h-4 text-surface-400 group-hover:text-white" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full bg-black relative">
                                <div className="absolute top-4 left-4 z-30">
                                    <button onClick={() => setView('list')} className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* Flash button */}
                                {torchSupported && (
                                    <button
                                        onClick={toggleTorch}
                                        className={cn(
                                            'absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200',
                                            torchOn
                                                ? 'bg-yellow-400 text-yellow-900 shadow-lg'
                                                : 'bg-black/50 text-white/80',
                                        )}
                                    >
                                        {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
                                    </button>
                                )}
                                <div id="product-scanner-container" ref={scannerRef} className="w-full h-full flex-1" />

                                {/* Overlay styling (mask) */}
                                <div className="absolute inset-0 pointer-events-none z-10">
                                    <div className="absolute top-0 left-0 right-0 bg-black/40" style={{ height: '35%' }} />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/40" style={{ height: '35%' }} />
                                    <div className="absolute bg-black/40" style={{ top: '35%', bottom: '35%', left: 0, width: '10%' }} />
                                    <div className="absolute bg-black/40" style={{ top: '35%', bottom: '35%', right: 0, width: '10%' }} />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                    <div className="relative" style={{ width: '80%', height: '30%' }}>
                                        <div className="absolute -top-px -left-px w-6 h-6 border-t-[3px] border-l-[3px] border-accent-400 rounded-tl-xl" />
                                        <div className="absolute -top-px -right-px w-6 h-6 border-t-[3px] border-r-[3px] border-accent-400 rounded-tr-xl" />
                                        <div className="absolute -bottom-px -left-px w-6 h-6 border-b-[3px] border-l-[3px] border-accent-400 rounded-bl-xl" />
                                        <div className="absolute -bottom-px -right-px w-6 h-6 border-b-[3px] border-r-[3px] border-accent-400 rounded-br-xl" />
                                        <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-accent-400 to-transparent animate-scan" />
                                    </div>
                                </div>
                                <div className="absolute bottom-6 left-0 right-0 text-center z-20">
                                    <p className="text-[11px] text-white/80 font-medium bg-black/40 inline-block py-1 px-3 rounded-full backdrop-blur-sm">
                                        Đưa mã vạch vào khung · Tự động thêm +1
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Queue ──────────────────────────────────── */}
                <div className="w-full lg:w-96 flex flex-col min-h-0 bg-white rounded-2xl border border-surface-100 shadow-sm shrink-0 h-[40vh] lg:h-auto">
                    {/* Queue header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 shrink-0">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-accent-500" />
                            <h2 className="text-sm font-bold text-surface-800">Hàng đợi</h2>
                            <span className="text-xs font-bold text-white bg-accent-500 rounded-full px-2 py-0.5">{queue.length}</span>
                        </div>
                        <button
                            onClick={loadQueue}
                            disabled={loadingQueue}
                            className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 transition-colors"
                        >
                            <RotateCcw className={cn("w-3.5 h-3.5", loadingQueue && "animate-spin")} />
                        </button>
                    </div>

                    {/* Queue list */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {loadingQueue ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-accent-500" />
                            </div>
                        ) : queue.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-surface-400">
                                <Package className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm font-medium">Chưa có sản phẩm nào</p>
                                <p className="text-xs mt-1">Chọn hoặc quét mã để thêm</p>
                            </div>
                        ) : (
                            queue.map((item, index) => (
                                <div key={item.id || index} className="flex items-center gap-3 bg-surface-50 rounded-xl border border-surface-100 p-3">
                                    <div className="w-10 h-10 rounded-lg bg-white border border-surface-100 flex items-center justify-center shrink-0">
                                        <Package className="w-5 h-5 text-surface-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-surface-800 line-clamp-2">{item.product_name || item.barcode}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-accent-600 bg-accent-50 px-1.5 py-0.5 rounded">SL: {item.quantity}</span>
                                            <span className="text-[10px] text-surface-400 truncate">{item.barcode}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleCancel(item.id)}
                                        disabled={cancellingId === item.id}
                                        className="p-2 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                                    >
                                        {cancellingId === item.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Scan line animation */}
            <style jsx global>{`
                @keyframes scan {
                    0%, 100% { top: 8%; opacity: 0; }
                    10% { opacity: 1; }
                    50% { top: 82%; opacity: 1; }
                    60% { opacity: 0; }
                }
                .animate-scan {
                    position: absolute;
                    animation: scan 1.8s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
