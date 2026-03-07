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

interface Category { id: string; name: string; }

const EMPTY_FORM: Partial<ProductDoc> = {
    companyCode: '', barcode: '', name: '', image: '', unit: '',
    category: '', invoicePrice: 0, actualPrice: 0, origin: '', minStock: 0,
};

export default function ProductManagementPage() {
    const { user, userDoc } = useAuth();
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

    // Guard: admin only
    if (userDoc && userDoc.role !== 'admin') {
        return <div className="flex items-center justify-center h-64 text-red-500 font-bold">Chỉ quản trị viên mới có quyền truy cập.</div>;
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
            ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
            : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />;
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

    return (
        <div className="space-y-6 mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Package className="w-7 h-7 text-blue-600" />
                        Quản lý Sản phẩm
                    </h1>
                    <p className="text-slate-500 mt-1">Danh mục sản phẩm trong hệ thống kho ({products.length} sản phẩm)</p>
                </div>
                <div className="flex items-center gap-2">
                    <ExcelImportModal getToken={async () => getToken()} onSuccess={fetchProducts} />
                    <button onClick={openAdd}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md transition-colors">
                        <Plus className="w-4 h-4" /> Thêm sản phẩm
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm theo tên, mã vạch, mã nội bộ..."
                            className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none sm:w-40">
                        <option value="">Tất cả danh mục</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm cursor-pointer select-none whitespace-nowrap">
                        <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="accent-blue-600" />
                        Hiện đã tắt
                    </label>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Package className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm text-slate-400">Không có sản phẩm nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                    <th className="px-4 py-3">
                                        <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                                            Tên sản phẩm <SortIcon col="name" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button onClick={() => handleSort('companyCode')} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                                            Mã <SortIcon col="companyCode" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button onClick={() => handleSort('category')} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                                            Danh mục <SortIcon col="category" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button onClick={() => handleSort('unit')} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                                            ĐVT <SortIcon col="unit" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button onClick={() => handleSort('invoicePrice')} className="flex items-center gap-1 hover:text-slate-800 transition-colors ml-auto">
                                            Giá nhập <SortIcon col="invoicePrice" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button onClick={() => handleSort('actualPrice')} className="flex items-center gap-1 hover:text-slate-800 transition-colors ml-auto">
                                            Giá bán <SortIcon col="actualPrice" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-center">
                                        <button onClick={() => handleSort('minStock')} className="flex items-center gap-1 hover:text-slate-800 transition-colors mx-auto">
                                            Min <SortIcon col="minStock" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-center">Trạng thái</th>
                                    <th className="px-4 py-3 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${!p.isActive ? 'opacity-50' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {p.image ? (
                                                    <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Package className="w-4 h-4 text-slate-400" /></div>
                                                )}
                                                <span className="font-medium text-slate-700">{p.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.companyCode || p.barcode || '—'}</td>
                                        <td className="px-4 py-3">
                                            {p.category && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">{p.category}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700">{p.invoicePrice?.toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{p.actualPrice?.toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-3 text-center text-slate-500">{p.minStock}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => toggleActive(p)} title={p.isActive ? 'Tắt' : 'Bật'}>
                                                {p.isActive
                                                    ? <ToggleRight className="w-6 h-6 text-emerald-500 mx-auto" />
                                                    : <ToggleLeft className="w-6 h-6 text-slate-300 mx-auto" />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => openEdit(p)}
                                                className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors">
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
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
                                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1"><X className="w-5 h-5" /></button>
                            </div>

                            {message.text && (
                                <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                    {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                    {message.text}
                                </div>
                            )}

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><Tag className="w-3 h-3" /> Tên hàng hóa *</label>
                                        <input value={form.name || ''} onChange={e => updateForm('name', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" placeholder="VD: Nước suối Aquafina 500ml" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><Barcode className="w-3 h-3" /> Mã nội bộ</label>
                                        <input value={form.companyCode || ''} onChange={e => updateForm('companyCode', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><Barcode className="w-3 h-3" /> Mã vạch</label>
                                        <input value={form.barcode || ''} onChange={e => updateForm('barcode', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><Layers className="w-3 h-3" /> Danh mục</label>
                                        <select value={form.category || ''} onChange={e => updateForm('category', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300">
                                            <option value="">-- Chọn --</option>
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 mb-1 block">Đơn vị tính</label>
                                        <input value={form.unit || ''} onChange={e => updateForm('unit', e.target.value)}
                                            placeholder="VD: Thùng, Hộp, Cái"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><DollarSign className="w-3 h-3" /> Giá hóa đơn (nhập)</label>
                                        <input type="number" min={0} value={form.invoicePrice || ''} onChange={e => updateForm('invoicePrice', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><DollarSign className="w-3 h-3" /> Giá thực tế (bán)</label>
                                        <input type="number" min={0} value={form.actualPrice || ''} onChange={e => updateForm('actualPrice', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" /> Xuất xứ</label>
                                        <input value={form.origin || ''} onChange={e => updateForm('origin', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 mb-1 block">Tồn kho tối thiểu</label>
                                        <input type="number" min={0} value={form.minStock || ''} onChange={e => updateForm('minStock', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                                            <ImagePlus className="w-3 h-3" /> Hình ảnh sản phẩm
                                        </label>

                                        {/* Preview area */}
                                        <div
                                            onClick={() => !imageCompressing && fileInputRef.current?.click()}
                                            className={`relative w-full h-36 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-colors ${imageCompressing ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
                                                }`}
                                        >
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="preview" className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                                    <Upload className="w-8 h-8" />
                                                    <p className="text-xs font-medium">Nhấn để chọn ảnh</p>
                                                    <p className="text-[10px]">JPG, PNG, WebP — tối đa 5 MB</p>
                                                </div>
                                            )}

                                            {/* Compression-in-progress overlay */}
                                            {imageCompressing && (
                                                <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                                    <p className="text-xs font-bold text-violet-700">Đang nén ảnh...</p>
                                                </div>
                                            )}
                                            {/* Upload-in-progress overlay (shown during Save) */}
                                            {!imageCompressing && uploadStatus === 'uploading' && (
                                                <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                                    <p className="text-xs font-bold text-blue-700">Đang tải lên... {uploadProgress}%</p>
                                                    <div className="w-3/4 bg-slate-200 rounded-full h-1.5">
                                                        <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
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
                                                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-40"
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
                                                    className="text-xs text-red-400 hover:text-red-600"
                                                >Xóa ảnh</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 flex gap-3">
                                <button
                                    onClick={() => {
                                        // Revoke pending blob to prevent memory leak on cancel
                                        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
                                        setModalOpen(false);
                                    }}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium text-sm transition-colors"
                                >
                                    Hủy
                                </button>
                                <button onClick={handleSave} disabled={saving || imageCompressing}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md">
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
