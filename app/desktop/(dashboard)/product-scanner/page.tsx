'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScanLine, Search, Camera, RotateCcw, Zap, ZapOff, ChevronDown, Loader2, Package, X, Plus, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/utils/toast';
import { preloadScannerData, getWmsWarehouseMappingAction, getAvailableWmsWarehousesAction, getLocationScansAction, submitExternalScanAction, getWmsLocationsAction } from '@/actions/scanner';
import type { PreloadedProduct } from '@/actions/scanner';
import { useAuth } from '@/contexts/AuthContext';
import type { Html5Qrcode } from 'html5-qrcode';

type WmsWarehouse = {
    id: string;
    name: string;
    code: string;
};

type WmsLocation = {
    id: string;
    name: string;
    code: string;
};

type QueueItem = {
    id: string;
    product_id?: string;
    product_name?: string;
    product_code?: string;
    product_barcode?: string;
    product_image_url?: string | null;
    product_unit?: string | null;
    product_type?: string | null;
    barcode_scanned?: string;
    barcode?: string;
    quantity?: number;
    unit_price?: number;
    warehouse_location_id?: string;
};

type GroupedQueueItem = {
    key: string;
    ids: string[];
    quantity: number;
    productId?: string;
    name: string;
    code: string;
    barcode: string;
    image: string;
    unit: string;
    unitPrice: number;
    atpQuantity?: number;
};

type WindowWithLegacyAudio = Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
};

type SubmitSource = 'manual' | 'camera';

type CacheEnvelope<T> = {
    savedAt: number;
    data: T;
};

const STORAGE_PREFIX = 'product-scanner:v2';

const makeStorageKey = (...parts: string[]) => `${STORAGE_PREFIX}:${parts.join(':')}`;

const readStorageJson = <T,>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : null;
    } catch {
        return null;
    }
};

const writeStorageJson = <T,>(key: string, value: T) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage can be unavailable in private mode or full quota.
    }
};

const readCache = <T,>(key: string): T | null => readStorageJson<CacheEnvelope<T>>(key)?.data ?? null;

const writeCache = <T,>(key: string, data: T) => {
    writeStorageJson<CacheEnvelope<T>>(key, { savedAt: Date.now(), data });
};

const formatVnd = (value: number) =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(value);

const getOperatorDisplayName = (
    userDocName?: string | null,
    authDisplayName?: string | null,
    email?: string | null,
) => {
    const firstAvailable = [userDocName, authDisplayName]
        .map(value => value?.trim())
        .find(Boolean);
    if (firstAvailable) return firstAvailable;
    return email?.trim() || 'Unknown';
};

// ── Beep via Web Audio API ───────────────────────────────────────
function playBeep(frequency = 1200, duration = 80, volume = 0.4) {
    try {
        const AudioContextCtor = window.AudioContext || (window as WindowWithLegacyAudio).webkitAudioContext;
        if (!AudioContextCtor) return;
        const ctx = new AudioContextCtor();
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
    const { user: authUser, userDoc, effectiveStoreId } = useAuth();
    const isAdmin = userDoc?.role === 'super_admin' || userDoc?.role === 'admin';
    const hasStoreContext = !!(effectiveStoreId || userDoc?.storeId);

    // Scanner state
    const [view, setView] = useState<'list' | 'camera'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);

    const scannerRef = useRef<HTMLDivElement>(null);
    const html5QrRef = useRef<Html5Qrcode | null>(null);
    const scanLock = useRef(false);

    // Preloaded data
    const [preloadedProducts, setPreloadedProducts] = useState<PreloadedProduct[]>([]);
    const [preloading, setPreloading] = useState(false);

    // Warehouse & Location
    const [wmsWarehouseId, setWmsWarehouseId] = useState<string | null>(null);
    const [availableWarehouses, setAvailableWarehouses] = useState<WmsWarehouse[]>([]);
    const [locations, setLocations] = useState<WmsLocation[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [loadingLocs, setLoadingLocs] = useState(false);

    const canSelectWarehouse = isAdmin && !hasStoreContext;
    const storageScope = useMemo(
        () => authUser?.uid || effectiveStoreId || userDoc?.storeId || 'anonymous',
        [authUser?.uid, effectiveStoreId, userDoc?.storeId],
    );
    const selectedWarehouseStorageKey = useMemo(
        () => makeStorageKey(storageScope, 'selectedWarehouse'),
        [storageScope],
    );

    // Queue
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [cameraQueuedProduct, setCameraQueuedProduct] = useState<PreloadedProduct | null>(null);

    // ── Preload data ──────────────────────────────────────────────
    useEffect(() => {
        if (!authUser || !userDoc) return;
        if (!canSelectWarehouse && !hasStoreContext) return;
        let isMounted = true;

        const fetchPreloadData = async () => {
            if (isMounted) {
                setLocations([]);
                setSelectedLocationId('');
                setWmsWarehouseId(null);
            }
            try {
                let warehouseIdToUse: string | null = null;

                if (hasStoreContext) {
                    const storeContextId = effectiveStoreId || userDoc.storeId || '';
                    const mappingCacheKey = makeStorageKey(storageScope, 'mappedWarehouse', storeContextId);
                    const cachedWarehouseId = readCache<string>(mappingCacheKey);
                    if (cachedWarehouseId && isMounted) {
                        warehouseIdToUse = cachedWarehouseId;
                        setWmsWarehouseId(cachedWarehouseId);
                    }

                    const mapRes = await getWmsWarehouseMappingAction(
                        'STORE',
                        storeContextId
                    );
                    if (mapRes.success && mapRes.wmsWarehouseId) {
                        warehouseIdToUse = mapRes.wmsWarehouseId;
                        writeCache(mappingCacheKey, mapRes.wmsWarehouseId);
                        if (isMounted) setWmsWarehouseId(warehouseIdToUse);
                    }
                }

                const cachedWarehouses = readCache<WmsWarehouse[]>(makeStorageKey('warehouses'));
                const savedWarehouseId = readStorageJson<string>(selectedWarehouseStorageKey);
                if (cachedWarehouses?.length && isMounted) {
                    setAvailableWarehouses(cachedWarehouses);
                    if (canSelectWarehouse) {
                        const cachedSelection = cachedWarehouses.some(wh => wh.id === savedWarehouseId)
                            ? savedWarehouseId!
                            : cachedWarehouses[0].id;
                        warehouseIdToUse = cachedSelection;
                        setWmsWarehouseId(cachedSelection);
                    }
                }

                const whRes = await getAvailableWmsWarehousesAction();
                if (whRes.success && whRes.data) {
                    const warehouses = whRes.data as WmsWarehouse[];
                    writeCache(makeStorageKey('warehouses'), warehouses);

                    if (isMounted) {
                        setAvailableWarehouses(warehouses);
                    }

                    if (canSelectWarehouse) {
                        if (!warehouseIdToUse && warehouses.length > 0) {
                            warehouseIdToUse = warehouses.some(wh => wh.id === savedWarehouseId)
                                ? savedWarehouseId!
                                : warehouses[0].id;
                        } else if (warehouseIdToUse && !warehouses.some(wh => wh.id === warehouseIdToUse)) {
                            warehouseIdToUse = warehouses[0]?.id ?? null;
                        }
                        if (isMounted && warehouseIdToUse) {
                            setWmsWarehouseId(warehouseIdToUse);
                        }
                    }
                } else if (whRes.error) {
                    console.error('[ProductScanner] Warehouse API failed:', whRes.error, whRes.apiUrl);
                }
            } catch (err) {
                console.error('[ProductScanner] Preload failed:', err);
            }
        };

        fetchPreloadData();
        return () => { isMounted = false; };
    }, [authUser, userDoc, canSelectWarehouse, hasStoreContext, effectiveStoreId, selectedWarehouseStorageKey, storageScope]);

    // ── Handle warehouse change ──────────────────────────────────
    const handleWarehouseChange = async (newId: string) => {
        writeStorageJson(selectedWarehouseStorageKey, newId);
        setSelectedLocationId('');
        setWmsWarehouseId(newId);
        setPreloadedProducts([]);
        loadQueue();
    };

    useEffect(() => {
        if (canSelectWarehouse && wmsWarehouseId) {
            writeStorageJson(selectedWarehouseStorageKey, wmsWarehouseId);
        }
    }, [canSelectWarehouse, selectedWarehouseStorageKey, wmsWarehouseId]);

    // ── Load locations ──────────────────────────────────────────
    useEffect(() => {
        if (!wmsWarehouseId) return;

        let isMounted = true;
        const locationCacheKey = makeStorageKey('locations', wmsWarehouseId);
        const selectedLocationStorageKey = makeStorageKey(storageScope, 'selectedLocation', wmsWarehouseId);
        const savedLocationId = readStorageJson<string>(selectedLocationStorageKey);
        const cachedLocations = readCache<WmsLocation[]>(locationCacheKey);

        setLoadingLocs(!cachedLocations?.length);
        setLocations(cachedLocations ?? []);
        setPreloadedProducts([]);

        if (cachedLocations?.length) {
            const nextLocationId = cachedLocations.some(loc => loc.id === savedLocationId)
                ? savedLocationId!
                : cachedLocations[0].id;
            setSelectedLocationId(nextLocationId);
        } else {
            setSelectedLocationId('');
        }

        getWmsLocationsAction(wmsWarehouseId).then(res => {
            if (!isMounted) return;
            if (res.success && res.data) {
                const nextLocations = res.data as WmsLocation[];
                writeCache(locationCacheKey, nextLocations);
                setLocations(nextLocations);

                const storedLocationId = readStorageJson<string>(selectedLocationStorageKey);
                const nextLocationId = storedLocationId && nextLocations.some(loc => loc.id === storedLocationId)
                    ? storedLocationId
                    : nextLocations[0]?.id ?? '';
                setSelectedLocationId(nextLocationId);
                if (nextLocationId) writeStorageJson(selectedLocationStorageKey, nextLocationId);
            } else if (res.error) {
                console.error('[ProductScanner] Locations API failed:', res.error);
            }
            setLoadingLocs(false);
        });

        return () => { isMounted = false; };
    }, [wmsWarehouseId, storageScope]);

    const handleLocationChange = (locationId: string) => {
        if (wmsWarehouseId) {
            writeStorageJson(makeStorageKey(storageScope, 'selectedLocation', wmsWarehouseId), locationId);
        }
        setSelectedLocationId(locationId);
    };

    useEffect(() => {
        if (wmsWarehouseId && selectedLocationId) {
            writeStorageJson(makeStorageKey(storageScope, 'selectedLocation', wmsWarehouseId), selectedLocationId);
        }
    }, [selectedLocationId, storageScope, wmsWarehouseId]);

    // ── Load products by selected location ATP ─────────────────────
    useEffect(() => {
        if (!wmsWarehouseId || !selectedLocationId) {
            setPreloadedProducts([]);
            return;
        }

        let isMounted = true;
        const productsCacheKey = makeStorageKey('products', wmsWarehouseId, selectedLocationId);
        const cachedProducts = readCache<PreloadedProduct[]>(productsCacheKey);

        if (cachedProducts?.length) {
            setPreloadedProducts(cachedProducts);
        } else {
            setPreloadedProducts([]);
        }

        setPreloading(true);

        preloadScannerData(wmsWarehouseId, selectedLocationId, { includeEmployees: false })
            .then(data => {
                writeCache(productsCacheKey, data.products);
                if (isMounted) setPreloadedProducts(data.products);
            })
            .catch(err => {
                console.error('[ProductScanner] Product reload failed:', err);
                if (isMounted && !cachedProducts?.length) setPreloadedProducts([]);
            })
            .finally(() => {
                if (isMounted) setPreloading(false);
            });

        return () => { isMounted = false; };
    }, [wmsWarehouseId, selectedLocationId]);

    // ── Load queue ──────────────────────────────────────────────
    const loadQueue = useCallback(async () => {
        if (!wmsWarehouseId || !selectedLocationId) return;
        setLoadingQueue(true);
        try {
            const result = await getLocationScansAction(wmsWarehouseId, selectedLocationId);
            if (result.success) {
                setQueue((result.data || []) as QueueItem[]);
            } else if (result.error) {
                console.error('[ProductScanner] Queue API failed:', result.error);
            }
        } catch (err) {
            console.error('[ProductScanner] Queue load failed:', err);
        } finally {
            setLoadingQueue(false);
        }
    }, [selectedLocationId, wmsWarehouseId]);

    useEffect(() => { loadQueue(); }, [loadQueue]);

    // ── Add product ─────────────────────────────────────────────
    const handleSubmitProduct = useCallback(async (product: PreloadedProduct, source: SubmitSource = 'manual') => {
        if (!wmsWarehouseId) return alert('Lỗi: Chưa liên kết với kho WMS nào.');
        if (!selectedLocationId) return alert('Lỗi: Vui lòng chọn vị trí/kệ hàng xuất kho.');
        if (!authUser) return;

        setSubmittingId(product.id);
        if (source === 'camera') setCameraQueuedProduct(null);
        let queuedSuccessfully = false;

        try {
            const result = await submitExternalScanAction({
                warehouse_id: wmsWarehouseId,
                barcode: product.barcode || '',
                product_id: product.id,
                warehouse_location_id: selectedLocationId,
                quantity: 1, // Add immediately 1 item
                operator_name: getOperatorDisplayName(userDoc?.name, authUser.displayName, authUser.email),
                operator_id_external: authUser.uid,
                device_id: null,
            });
            if (result.success) {
                playBeep(1800, 100);
                showToast.success(
                    'Đã thêm vào hàng chờ',
                    `+1 ${product.companyCode || product.barcode || product.name}`,
                );
                setPreloadedProducts(prev => {
                    const nextProducts = prev
                        .map(item => item.id === product.id
                            ? { ...item, atpQuantity: Math.max(0, item.atpQuantity - 1) }
                            : item)
                        .filter(item => item.atpQuantity > 0);
                    writeCache(makeStorageKey('products', wmsWarehouseId, selectedLocationId), nextProducts);
                    return nextProducts;
                });
                await loadQueue();
                queuedSuccessfully = true;
                if (source === 'camera') setCameraQueuedProduct(product);
            } else {
                alert('Lỗi: ' + (result.messages?.vi || 'Không thể thêm vào WMS'));
            }
        } catch {
            alert('Lỗi hệ thống khi lưu');
        } finally {
            setSubmittingId(null);
            if (source === 'manual' || !queuedSuccessfully) {
                setTimeout(() => { scanLock.current = false; }, 1000);
            }
        }
    }, [authUser, loadQueue, selectedLocationId, userDoc?.name, wmsWarehouseId]);

    // ── Camera setup ────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        if (!scannerRef.current) return;
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
                        advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
                    },
                },
                (text: string) => {
                    if (scanLock.current) return;
                    scanLock.current = true;

                    const product = preloadedProducts.find(
                        p => p.barcode === text || p.companyCode === text
                    );

                    if (product) {
                        handleSubmitProduct(product, 'camera');
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
    }, [handleSubmitProduct, preloadedProducts]);

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

    const resumeCameraScan = useCallback(() => {
        setCameraQueuedProduct(null);
        scanLock.current = false;
    }, []);

    const toggleTorch = useCallback(async () => {
        try {
            const video = document.querySelector<HTMLVideoElement>('#product-scanner-container video');
            const track = video?.srcObject instanceof MediaStream
                ? (video.srcObject as MediaStream).getVideoTracks()[0] : null;
            if (!track) return;
            const newState = !torchOn;
            await track.applyConstraints({ advanced: [{ torch: newState } as MediaTrackConstraintSet] });
            setTorchOn(newState);
        } catch { /* torch not supported */ }
    }, [torchOn]);

    const checkTorchSupport = useCallback(() => {
        const video = document.querySelector<HTMLVideoElement>('#product-scanner-container video');
        const track = video?.srcObject instanceof MediaStream
            ? (video.srcObject as MediaStream).getVideoTracks()[0] : null;
        if (!track) return;
        const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchSupported(!!caps?.torch);
    }, []);

    useEffect(() => {
        if (view === 'camera') {
            setCameraQueuedProduct(null);
            scanLock.current = false;
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
    const productLookup = useMemo(() => {
        const byId = new Map<string, PreloadedProduct>();
        const byCode = new Map<string, PreloadedProduct>();
        for (const product of preloadedProducts) {
            byId.set(product.id, product);
            if (product.barcode) byCode.set(product.barcode, product);
            if (product.companyCode) byCode.set(product.companyCode, product);
        }
        return { byId, byCode };
    }, [preloadedProducts]);
    const groupedQueue = useMemo(() => {
        const groups = new Map<string, GroupedQueueItem>();

        for (const item of queue) {
            const product =
                (item.product_id ? productLookup.byId.get(item.product_id) : undefined) ||
                (item.product_barcode ? productLookup.byCode.get(item.product_barcode) : undefined) ||
                (item.barcode_scanned ? productLookup.byCode.get(item.barcode_scanned) : undefined) ||
                (item.barcode ? productLookup.byCode.get(item.barcode) : undefined);
            const productId = item.product_id || product?.id;
            const barcode = product?.barcode || item.product_barcode || item.barcode_scanned || item.barcode || '';
            const code = product?.companyCode || item.product_code || '';
            const key = `${item.warehouse_location_id || selectedLocationId || 'location'}:${productId || barcode || item.id}`;
            const quantity = Number(item.quantity ?? 0);
            const existing = groups.get(key);

            if (existing) {
                existing.ids.push(item.id);
                existing.quantity += quantity;
                if (!existing.atpQuantity && product?.atpQuantity) existing.atpQuantity = product.atpQuantity;
                continue;
            }

            groups.set(key, {
                key,
                ids: [item.id],
                quantity,
                productId,
                name: product?.name || item.product_name || barcode || 'Sản phẩm chưa xác định',
                code,
                barcode,
                image: product?.image || item.product_image_url || '',
                unit: product?.unit || item.product_unit || '',
                unitPrice: Number(item.unit_price ?? product?.actualPrice ?? 0),
                atpQuantity: product?.atpQuantity,
            });
        }

        return [...groups.values()];
    }, [productLookup, queue, selectedLocationId]);
    const totalQueuedQuantity = useMemo(
        () => groupedQueue.reduce((sum, item) => sum + item.quantity, 0),
        [groupedQueue],
    );
    const showInitialProductLoading = preloading && preloadedProducts.length === 0;

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
                                        {availableWarehouses.find(wh => wh.id === wmsWarehouseId)
                                            ? `${availableWarehouses.find(wh => wh.id === wmsWarehouseId)?.name} (${availableWarehouses.find(wh => wh.id === wmsWarehouseId)?.code})`
                                            : `ID: ${wmsWarehouseId}`}
                                    </div>
                                </div>
                            )
                        )}

                        <div>
                            <label className="block text-[11px] font-bold text-surface-500 uppercase mb-1">Vị trí lưu trữ (Kệ)</label>
                            <div className="relative">
                                <select
                                    value={selectedLocationId}
                                    onChange={e => handleLocationChange(e.target.value)}
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
                                    {preloading && preloadedProducts.length > 0 && (
                                        <div className="hidden md:flex items-center gap-1.5 px-2.5 rounded-xl bg-surface-50 border border-surface-200 text-[11px] font-semibold text-surface-500">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-500" />
                                            ATP
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setView('camera')}
                                        className="px-4 rounded-xl bg-surface-800 text-white flex items-center justify-center gap-2 hover:bg-surface-900 active:scale-95 transition-transform text-sm font-bold"
                                    >
                                        <Camera className="w-4 h-4" />
                                        <span className="hidden sm:inline">Quét mã</span>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 bg-surface-50 min-h-0">
                                    {showInitialProductLoading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-accent-500" /></div>
                                    ) : filteredProducts.length === 0 ? (
                                        <div className="text-center py-8 text-surface-400 text-sm">
                                            {selectedLocationId ? 'Không có sản phẩm còn ATP tại vị trí này.' : 'Vui lòng chọn vị trí để xem sản phẩm.'}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-16">
                                            {filteredProducts.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="flex items-center gap-3 p-3 rounded-xl border border-surface-100 hover:border-accent-300 hover:bg-accent-50 transition-all text-left group"
                                                >
                                                    <div className="w-12 h-12 bg-white rounded-lg border border-surface-100 overflow-hidden flex items-center justify-center shrink-0">
                                                        {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-1" /> : <Package className="w-6 h-6 text-surface-300" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-xs font-bold text-surface-800 line-clamp-2 group-hover:text-accent-700 transition-colors">{p.name}</h3>
                                                        <div className="mt-1 flex items-center gap-1.5 min-w-0">
                                                            <p className="text-[10px] text-surface-400 truncate">{p.barcode || p.companyCode}</p>
                                                            <span className="shrink-0 text-[10px] font-bold text-success-700 bg-success-50 border border-success-100 rounded-md px-1.5 py-0.5">
                                                                ATP: {p.atpQuantity}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSubmitProduct(p)}
                                                        disabled={submittingId === p.id}
                                                        title="Thêm vào hàng chờ"
                                                        aria-label={`Thêm ${p.name} vào hàng chờ`}
                                                        className="group/add w-8 h-8 rounded-full bg-surface-50 border border-surface-200 hover:bg-accent-500 hover:border-accent-500 disabled:hover:bg-surface-50 disabled:hover:border-surface-200 flex items-center justify-center shrink-0 transition-colors"
                                                    >
                                                        {submittingId === p.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-accent-500" />
                                                        ) : (
                                                            <Plus className="w-4 h-4 text-surface-400 group-hover/add:text-white" />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full max-h-96 bg-black relative">
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

                                {cameraQueuedProduct && (
                                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-30 rounded-2xl bg-white/95 border border-white/70 shadow-2xl p-4 backdrop-blur-md">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-success-50 text-success-600 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-6 h-6" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-surface-900">Đã thêm vào hàng chờ</p>
                                                <p className="mt-1 text-xs text-surface-500 line-clamp-2">{cameraQueuedProduct.name}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                                                    <span className="rounded-md bg-accent-50 text-accent-700 border border-accent-100 px-1.5 py-0.5">+1</span>
                                                    {(cameraQueuedProduct.companyCode || cameraQueuedProduct.barcode) && (
                                                        <span className="rounded-md bg-surface-100 text-surface-600 px-1.5 py-0.5">
                                                            {cameraQueuedProduct.companyCode || cameraQueuedProduct.barcode}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={resumeCameraScan}
                                                className="flex-1 rounded-xl bg-accent-500 text-white text-sm font-bold py-2.5 hover:bg-accent-600 active:scale-[0.98] transition-all"
                                            >
                                                Quét tiếp
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setView('list')}
                                                className="px-4 rounded-xl bg-surface-100 text-surface-700 text-sm font-bold hover:bg-surface-200 active:scale-[0.98] transition-all"
                                            >
                                                Xem hàng chờ
                                            </button>
                                        </div>
                                    </div>
                                )}

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
                                        {!cameraQueuedProduct && (
                                            <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-accent-400 to-transparent animate-scan" />
                                        )}
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
                            <span className="text-xs font-bold text-white bg-accent-500 rounded-full px-2 py-0.5">
                                {groupedQueue.length} dòng · SL {totalQueuedQuantity}
                            </span>
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
                        ) : groupedQueue.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-surface-400">
                                <Package className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm font-medium">Chưa có sản phẩm nào</p>
                                <p className="text-xs mt-1">Chọn hoặc quét mã để thêm</p>
                            </div>
                        ) : (
                            groupedQueue.map((item) => (
                                <div key={item.key} className="flex items-center gap-3 bg-surface-50 rounded-xl border border-surface-100 p-3">
                                    <div className="w-12 h-12 rounded-lg bg-white border border-surface-100 overflow-hidden flex items-center justify-center shrink-0">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1" />
                                        ) : (
                                            <Package className="w-5 h-5 text-surface-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-surface-800 line-clamp-2">{item.name}</p>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-accent-600 bg-accent-50 px-1.5 py-0.5 rounded">SL: {item.quantity}</span>
                                            {item.unit && <span className="text-[10px] text-surface-500 bg-white border border-surface-100 px-1.5 py-0.5 rounded">{item.unit}</span>}
                                            {item.atpQuantity !== undefined && (
                                                <span className="text-[10px] font-bold text-success-700 bg-success-50 border border-success-100 px-1.5 py-0.5 rounded">
                                                    ATP: {item.atpQuantity}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[10px] text-surface-400">
                                            {item.code && <span className="shrink-0 font-medium">{item.code}</span>}
                                            {item.code && item.barcode && <span className="shrink-0">·</span>}
                                            {item.barcode && <span className="truncate">{item.barcode}</span>}
                                        </div>
                                    </div>
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
