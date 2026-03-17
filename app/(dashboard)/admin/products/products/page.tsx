'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    Package, Plus, Pencil, X, Save, Search, CheckCircle2, AlertCircle,
    ToggleLeft, ToggleRight, Tag, Barcode, DollarSign, MapPin, Layers, ImagePlus, Upload,
    ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import type { ProductDoc } from '@/types/inventory';
import Portal from '@/components/Portal';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import ExcelImportModal from '@/components/inventory/ExcelImportModal';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

interface Category { id: string; name: string; }

const EMPTY_FORM: Partial<ProductDoc> = {
    companyCode: '', barcode: '', name: '', image: '', unit: '',
    category: '', invoicePrice: 0, actualPrice: 0, origin: '', minStock: 0,
};

export default function ProductManagementPage() {
    const { user, userDoc, hasPermission } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [sortKey, setSortKey] = useState<keyof ProductDoc | ''>('');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<ProductDoc>>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Image state — deferred upload pattern:
    // compress on select → upload only inside handleSave
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [imageCompressing, setImageCompressing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<'compressing' | 'uploading' | ''>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Guard: admin or custom role with page.products permission
    if (userDoc && userDoc.role !== 'admin' && !hasPermission('page.products')) {
        return <div className="flex items-center justify-center h-64 text-danger-500 font-bold">Chỉ quản trị viên mới có quyền truy cập.</div>;
    }

    const fetchProducts = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/products?all=true', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, [user, getToken]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    // Fetch categories
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/inventory/categories', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCategories(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    const openAdd = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setModalOpen(true);
        setMessage({ type: '', text: '' });
        setPendingImageFile(null);
        setImagePreview('');
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    const openEdit = (p: ProductDoc) => {
        setEditingId(p.id);
        setForm({ ...p });
        setModalOpen(true);
        setMessage({ type: '', text: '' });
        setPendingImageFile(null);          // no pending file yet
        setImagePreview(p.image || '');    // show existing image
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Step 1: File selected → compress only, NO Firebase call ───
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setMessage({ type: 'error', text: 'Chỉ chấp nhận JPG, PNG hoặc WebP.' });
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'File quá lớn (tối đa 20 MB).' });
            return;
        }

        setImageCompressing(true);
        setUploadStatus('compressing');
        setMessage({ type: '', text: '' });

        // Revoke any previous blob URL to prevent memory leaks
        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);

        try {
            const compressed = await imageCompression(file, {
                maxSizeMB: 0.2,
                maxWidthOrHeight: 800,
                useWebWorker: true,
                fileType: 'image/webp',
            });

            console.log(
                `[ImageCompress] ${(file.size / 1024).toFixed(0)} KB → ${(compressed.size / 1024).toFixed(0)} KB`,
                `(saved ${(((file.size - compressed.size) / file.size) * 100).toFixed(0)}%)`
            );

            setPendingImageFile(compressed);
            setImagePreview(URL.createObjectURL(compressed)); // local blob preview
            setMessage({ type: '', text: `Ảnh đã sẵn sàng (${(compressed.size / 1024).toFixed(0)} KB). Nhấn Lưu để hoàn tất.` });
        } catch {
            setMessage({ type: 'error', text: 'Nén ảnh thất bại. Vui lòng chọn lại.' });
        } finally {
            setImageCompressing(false);
            setUploadStatus('');
        }
    };

    // Helper: upload a pending compressed file to Firebase Storage
    const uploadPendingImage = async (existingImageUrl: string): Promise<string> => {
        if (!pendingImageFile) return existingImageUrl;

        // Delete old Storage image to save quota
        if (existingImageUrl.includes('firebasestorage')) {
            try { await deleteObject(ref(storage, existingImageUrl)); } catch { /* already gone */ }
        }

        setUploadStatus('uploading');
        setUploadProgress(0);
        const storageRef = ref(storage, `products/${Date.now()}_${pendingImageFile.name.replace(/\.webp$/, '')}.webp`);
        const uploadTask = uploadBytesResumable(storageRef, pendingImageFile);

        return new Promise<string>((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                reject,
                async () => resolve(await getDownloadURL(uploadTask.snapshot.ref)),
            );
        });
    };

    // ── Step 2: Save → upload pending image first, then save doc ─
    const handleSave = async () => {
        if (!form.name?.trim()) { setMessage({ type: 'error', text: 'Tên sản phẩm không được để trống' }); return; }
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            // Upload image to Storage only now (no orphan files if user cancelled)
            let finalImageUrl = form.image || '';
            if (pendingImageFile) {
                setUploadStatus('uploading');
                finalImageUrl = await uploadPendingImage(finalImageUrl);
                setUploadStatus('');
                // Revoke blob URL after successful upload
                if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
            }

            const token = await getToken();
            const method = editingId ? 'PUT' : 'POST';
            const body = editingId
                ? { id: editingId, ...form, image: finalImageUrl }
                : { ...form, image: finalImageUrl };
            const res = await fetch('/api/inventory/products', {
                method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setPendingImageFile(null);
            setModalOpen(false);
            fetchProducts();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra';
            setMessage({ type: 'error', text: msg });
        } finally {
            setSaving(false);
            setUploadStatus('');
        }
    };

    const toggleActive = async (p: ProductDoc) => {
        try {
            const token = await getToken();
            await fetch('/api/inventory/products', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
            });
            fetchProducts();
        } catch { /* silent */ }
    };

    // Filtered + sorted products
    const handleSort = (key: keyof ProductDoc) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ col }: { col: keyof ProductDoc }) => {
        if (sortKey !== col) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
        return sortDir === 'asc'
            ? <ArrowUp className="w-3.5 h-3.5 text-primary-600" />
            : <ArrowDown className="w-3.5 h-3.5 text-primary-600" />;
    };

    const filtered = products
        .filter(p => {
            if (!showInactive && !p.isActive) return false;
            if (filterCategory && p.category !== filterCategory) return false;
            if (search) {
                const s = search.toLowerCase();
                return p.name.toLowerCase().includes(s) || p.barcode.toLowerCase().includes(s) || p.companyCode.toLowerCase().includes(s);
            }
            return true;
        })
        .sort((a, b) => {
            if (!sortKey) return 0;
            const aVal = a[sortKey] ?? '';
            const bVal = b[sortKey] ?? '';
            let cmp = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                cmp = aVal - bVal;
            } else {
                cmp = String(aVal).localeCompare(String(bVal), 'vi');
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

    const updateForm = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

    // ─── KPI Cards ──────────────────────────────────────────────────────────
    const activeCount = products.filter(p => p.isActive).length;
    const inactiveCount = products.filter(p => !p.isActive).length;
    const withImage = products.filter(p => p.image).length;
    const categoryCount = new Set(products.map(p => p.category).filter(Boolean)).size;

    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Package className="w-7 h-7 text-primary-600" />
                                Quản lý Sản phẩm
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Quản lý toàn bộ sản phẩm trong hệ thống kho hàng.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ExcelImportModal getToken={async () => getToken()} onSuccess={fetchProducts} />
                            <button onClick={openAdd}
                                className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-primary-500/20 transition-all active:scale-95">
                                <Plus className="w-4 h-4" /> Thêm sản phẩm
                            </button>
                        </div>
                    </div>
                }
            />

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-surface-800">{products.length}</p>
                            <p className="text-xs text-surface-500 font-medium">Tổng sản phẩm</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center">
                            <ToggleRight className="w-5 h-5 text-success-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-surface-800">{activeCount}</p>
                            <p className="text-xs text-surface-500 font-medium">Đang hoạt động</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-warning-100 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-warning-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-surface-800">{categoryCount}</p>
                            <p className="text-xs text-surface-500 font-medium">Danh mục</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
                            <ImagePlus className="w-5 h-5 text-accent-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-surface-800">{withImage}</p>
                            <p className="text-xs text-surface-500 font-medium">Có hình ảnh</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm theo tên, mã vạch, mã nội bộ..."
                            className="w-full pl-9 bg-surface-50 border border-surface-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 transition-all" />
                    </div>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                        className="bg-surface-50 border border-surface-200 rounded-xl p-2.5 text-sm outline-none sm:w-44 focus:ring-2 focus:ring-primary-300">
                        <option value="">Tất cả danh mục</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <label className="flex items-center gap-2 bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm cursor-pointer select-none whitespace-nowrap hover:bg-surface-100 transition-colors">
                        <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="accent-primary-600 w-4 h-4" />
                        Hiện đã tắt ({inactiveCount})
                    </label>
                </div>
                {(search || filterCategory) && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100">
                        <p className="text-xs text-surface-400">Hiển thị <span className="font-bold text-surface-600">{filtered.length}</span> / {products.length} sản phẩm</p>
                        {(search || filterCategory) && (
                            <button onClick={() => { setSearch(''); setFilterCategory(''); }} className="text-xs text-primary-500 hover:text-primary-700 font-medium">
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-surface-400">Đang tải sản phẩm...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
                            <Package className="w-8 h-8 text-surface-300" />
                        </div>
                        <p className="text-sm font-medium text-surface-500">Không tìm thấy sản phẩm nào</p>
                        <p className="text-xs text-surface-400">Thử thay đổi từ khóa hoặc bộ lọc</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] text-surface-500 uppercase tracking-wider bg-surface-50/80 border-b border-surface-200">
                                    <th className="px-5 py-3.5">
                                        <button onClick={() => handleSort('name')} className="flex items-center gap-1.5 hover:text-surface-800 transition-colors font-bold">
                                            Sản phẩm <SortIcon col="name" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5">
                                        <button onClick={() => handleSort('companyCode')} className="flex items-center gap-1.5 hover:text-surface-800 transition-colors font-bold">
                                            Mã SP <SortIcon col="companyCode" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5">
                                        <button onClick={() => handleSort('category')} className="flex items-center gap-1.5 hover:text-surface-800 transition-colors font-bold">
                                            Danh mục <SortIcon col="category" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5">
                                        <button onClick={() => handleSort('unit')} className="flex items-center gap-1.5 hover:text-surface-800 transition-colors font-bold">
                                            ĐVT <SortIcon col="unit" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-right">
                                        <button onClick={() => handleSort('invoicePrice')} className="flex items-center gap-1.5 hover:text-surface-800 transition-colors ml-auto font-bold">
                                            Giá nhập <SortIcon col="invoicePrice" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-right">
                                        <button onClick={() => handleSort('actualPrice')} className="flex items-center gap-1.5 hover:text-surface-800 transition-colors ml-auto font-bold">
                                            Giá bán <SortIcon col="actualPrice" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-center">
                                        <button onClick={() => handleSort('minStock')} className="flex items-center gap-1.5 hover:text-surface-800 transition-colors mx-auto font-bold">
                                            Tối thiểu <SortIcon col="minStock" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-center font-bold">Trạng thái</th>
                                    <th className="px-4 py-3.5 text-right font-bold">Sửa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {filtered.map(p => (
                                    <tr key={p.id} className={`group transition-colors ${!p.isActive ? 'opacity-40 bg-surface-50/50' : 'hover:bg-primary-50/30'}`}>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                {p.image ? (
                                                    <img src={p.image} alt="" className="w-10 h-10 rounded-xl object-cover border border-surface-200 shadow-sm group-hover:shadow-md transition-shadow" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-surface-100 to-surface-50 flex items-center justify-center border border-surface-200">
                                                        <Package className="w-4 h-4 text-surface-300" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <span className="font-semibold text-surface-800 truncate block">{p.name}</span>
                                                    {p.origin && <span className="text-[10px] text-surface-400">📍 {p.origin}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs bg-surface-100 text-surface-600 px-2 py-1 rounded-lg">{p.companyCode || p.barcode || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {p.category && (
                                                <span className="text-[11px] bg-accent-50 text-accent-600 px-2.5 py-1 rounded-lg font-semibold border border-accent-100">{p.category}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-surface-500 font-medium">{p.unit}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-sm font-medium text-surface-600">{p.invoicePrice?.toLocaleString('vi-VN')}đ</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-sm font-bold text-success-600 bg-success-50 px-2 py-0.5 rounded-lg">{p.actualPrice?.toLocaleString('vi-VN')}đ</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-semibold text-surface-600">{p.minStock}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => toggleActive(p)}
                                                title={p.isActive ? 'Tắt sản phẩm' : 'Bật sản phẩm'}
                                                className="group/toggle inline-flex items-center transition-transform hover:scale-110"
                                            >
                                                {p.isActive
                                                    ? <ToggleRight className="w-7 h-7 text-success-500 group-hover/toggle:text-success-600" />
                                                    : <ToggleLeft className="w-7 h-7 text-surface-300 group-hover/toggle:text-surface-500" />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => openEdit(p)}
                                                className="text-surface-400 hover:text-primary-600 p-2 rounded-xl hover:bg-primary-50 transition-all hover:shadow-sm">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {modalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-surface-800">{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
                                <button onClick={() => setModalOpen(false)} className="text-surface-400 hover:text-surface-700 p-1"><X className="w-5 h-5" /></button>
                            </div>

                            {message.text && (
                                <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-success-50 text-success-700'}`}>
                                    {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                    {message.text}
                                </div>
                            )}

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="text-xs font-bold text-surface-600 flex items-center gap-1 mb-1"><Tag className="w-3 h-3" /> Tên hàng hóa *</label>
                                        <input value={form.name || ''} onChange={e => updateForm('name', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" placeholder="VD: Nước suối Aquafina 500ml" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-600 flex items-center gap-1 mb-1"><Barcode className="w-3 h-3" /> Mã nội bộ</label>
                                        <input value={form.companyCode || ''} onChange={e => updateForm('companyCode', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-600 flex items-center gap-1 mb-1"><Barcode className="w-3 h-3" /> Mã vạch</label>
                                        <input value={form.barcode || ''} onChange={e => updateForm('barcode', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-600 flex items-center gap-1 mb-1"><Layers className="w-3 h-3" /> Danh mục</label>
                                        <select value={form.category || ''} onChange={e => updateForm('category', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300">
                                            <option value="">-- Chọn --</option>
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-600 mb-1 block">Đơn vị tính</label>
                                        <input value={form.unit || ''} onChange={e => updateForm('unit', e.target.value)}
                                            placeholder="VD: Thùng, Hộp, Cái"
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-600 flex items-center gap-1 mb-1"><DollarSign className="w-3 h-3" /> Giá hóa đơn (nhập)</label>
                                        <input type="number" min={0} value={form.invoicePrice || ''} onChange={e => updateForm('invoicePrice', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-600 flex items-center gap-1 mb-1"><DollarSign className="w-3 h-3" /> Giá thực tế (bán)</label>
                                        <input type="number" min={0} value={form.actualPrice || ''} onChange={e => updateForm('actualPrice', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-600 flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" /> Xuất xứ</label>
                                        <input value={form.origin || ''} onChange={e => updateForm('origin', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-600 mb-1 block">Tồn kho tối thiểu</label>
                                        <input type="number" min={0} value={form.minStock || ''} onChange={e => updateForm('minStock', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-xs font-bold text-surface-600 mb-2 flex items-center gap-1">
                                            <ImagePlus className="w-3 h-3" /> Hình ảnh sản phẩm
                                        </label>

                                        {/* Preview area */}
                                        <div
                                            onClick={() => !imageCompressing && fileInputRef.current?.click()}
                                            className={`relative w-full h-36 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-colors ${imageCompressing ? 'border-accent-300 bg-accent-50' : 'border-surface-200 bg-surface-50 hover:border-primary-400 hover:bg-primary-50/50'
                                                }`}
                                        >
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="preview" className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-surface-400">
                                                    <Upload className="w-8 h-8" />
                                                    <p className="text-xs font-medium">Nhấn để chọn ảnh</p>
                                                    <p className="text-[10px]">JPG, PNG, WebP — tối đa 5 MB</p>
                                                </div>
                                            )}

                                            {/* Compression-in-progress overlay */}
                                            {imageCompressing && (
                                                <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                                                    <p className="text-xs font-bold text-accent-700">Đang nén ảnh...</p>
                                                </div>
                                            )}
                                            {/* Upload-in-progress overlay (shown during Save) */}
                                            {!imageCompressing && uploadStatus === 'uploading' && (
                                                <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                                    <p className="text-xs font-bold text-primary-700">Đang tải lên... {uploadProgress}%</p>
                                                    <div className="w-3/4 bg-surface-200 rounded-full h-1.5">
                                                        <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Hidden file input */}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                            onChange={handleImageSelect}
                                        />

                                        {/* Action row */}
                                        <div className="flex items-center justify-between mt-2">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={imageCompressing || saving}
                                                className="text-xs font-medium text-primary-600 hover:text-primary-800 flex items-center gap-1 disabled:opacity-40"
                                            >
                                                <ImagePlus className="w-3.5 h-3.5" />
                                                {imagePreview ? 'Đổi ảnh' : 'Chọn ảnh'}
                                            </button>
                                            {imagePreview && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
                                                        setImagePreview('');
                                                        setPendingImageFile(null);
                                                        updateForm('image', '');
                                                    }}
                                                    className="text-xs text-danger-400 hover:text-danger-600"
                                                >Xóa ảnh</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-surface-100 flex gap-3">
                                <button
                                    onClick={() => {
                                        // Revoke pending blob to prevent memory leak on cancel
                                        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
                                        setModalOpen(false);
                                    }}
                                    className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 py-2.5 rounded-xl font-medium text-sm transition-colors"
                                >
                                    Hủy
                                </button>
                                <button onClick={handleSave} disabled={saving || imageCompressing}
                                    className="flex-1 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md">
                                    {(saving || uploadStatus === 'uploading') ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            {uploadStatus === 'uploading' ? 'Đang tải ảnh...' : 'Lưu dữ liệu...'}
                                        </>
                                    ) : (
                                        <><Save className="w-4 h-4" />{editingId ? 'Cập nhật' : 'Tạo mới'}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
