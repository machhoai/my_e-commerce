/**
 * PRIVATE ADMIN PRODUCT DETAIL — /admin/products/[sku]
 *
 * Server Component. Full product data view for internal staff.
 * Protected by the (dashboard) layout auth guard.
 *
 * The QR download interaction is handled by the co-located Client Component:
 *   ./_QRDownloadSection.tsx  ← 'use client', imported below
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminDb } from '@/lib/firebase-admin';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { Metadata } from 'next';
import { QRDownloadSection } from './_QRDownloadSection';

// ── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata(
    { params }: { params: Promise<{ sku: string }> }
): Promise<Metadata> {
    const { sku } = await params;
    return { title: `[Admin] Chi tiết sản phẩm: ${sku}` };
}

// ── Data Fetching Helpers (Server-only) ───────────────────────────────────────

/**
 * Look up a product by companyCode (primary) or barcode (fallback).
 * The URL slug is the companyCode/barcode — the Firestore doc ID stays internal.
 *
 * ── RBAC CHECK PLACEHOLDER ───────────────────────────────────────────────────
 * In production, verify the session cookie before any data access:
 *
 *   const session = cookies().get('session')?.value;
 *   const decoded = await getAdminAuth().verifySessionCookie(session, true);
 *   const allowedRoles = ['admin', 'super_admin', 'inventory_manager'];
 *   if (!allowedRoles.includes(decoded.role)) redirect('/403');
 *
 * The (dashboard) layout already handles auth; this is for granular role checks.
 * ─────────────────────────────────────────────────────────────────────────────
 */
async function getFullProduct(sku: string): Promise<ProductDoc | null> {
    try {
        const db = getAdminDb();

        // Try companyCode first, then barcode (never expose raw Firestore doc ID)
        let snap = await db
            .collection('products')
            .where('companyCode', '==', sku)
            .limit(1)
            .get();

        if (snap.empty) {
            snap = await db
                .collection('products')
                .where('barcode', '==', sku)
                .limit(1)
                .get();
        }

        if (snap.empty) return null;

        const doc = snap.docs[0];
        return { id: doc.id, ...doc.data() } as ProductDoc;
    } catch {
        return null;
    }
}

async function getInventoryBalances(productId: string): Promise<InventoryBalanceDoc[]> {
    try {
        const db = getAdminDb();
        const snap = await db
            .collection('inventory_balances')
            .where('productId', '==', productId)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryBalanceDoc));
    } catch {
        return [];
    }
}

// ── Formatters ────────────────────────────────────────────────────────────────
const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ';

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AdminProductDetailPage(
    { params }: { params: Promise<{ sku: string }> }
) {
    const { sku } = await params;
    const [product, balances] = await Promise.all([
        getFullProduct(sku),
        getInventoryBalances(sku),
    ]);

    if (!product) notFound();

    const margin = product.invoicePrice > 0
        ? (((product.actualPrice - product.invoicePrice) / product.invoicePrice) * 100).toFixed(1)
        : null;

    return (
        <div className="space-y-6">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-slate-500">
                <Link href="/admin/products/products" className="hover:text-primary-600 transition-colors">
                    Sản phẩm
                </Link>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-700 font-mono">{product.companyCode || product.barcode}</span>
            </nav>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* ── MAIN COLUMN (col-span-2) ───────────────────────────── */}
                <div className="md:col-span-2 space-y-5">

                    {/* Product header card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex flex-col sm:flex-row gap-5 p-6">
                            {/* Image */}
                            <div className="flex-shrink-0 w-full sm:w-36 h-36 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                                {product.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-slate-300 text-xs font-medium">Chưa có ảnh</span>
                                )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <h1 className="text-xl font-bold text-slate-800 leading-snug">
                                        {product.name}
                                    </h1>
                                    <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${product.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                        {product.isActive ? 'Hoạt động' : 'Đã tắt'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {product.category && (
                                        <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-100 font-semibold">
                                            {product.category}
                                        </span>
                                    )}
                                    {product.origin && (
                                        <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-0.5 rounded-full border border-amber-100 font-medium">
                                            📍 {product.origin}
                                        </span>
                                    )}
                                </div>
                                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm pt-1">
                                    <div className="flex items-center gap-2">
                                        <dt className="text-slate-400 text-xs">Mã nội bộ</dt>
                                        <dd className="font-mono font-semibold text-slate-700">{product.companyCode || '—'}</dd>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <dt className="text-slate-400 text-xs">Mã vạch</dt>
                                        <dd className="font-mono font-semibold text-slate-700">{product.barcode || '—'}</dd>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <dt className="text-slate-400 text-xs">Đơn vị</dt>
                                        <dd className="font-semibold text-slate-700">{product.unit || '—'}</dd>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <dt className="text-slate-400 text-xs">Tồn tối thiểu</dt>
                                        <dd className="font-semibold text-slate-700">{product.minStock}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>

                    {/* Pricing card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                            <span className="text-base font-bold text-slate-700">💰 Giá &amp; Chi Phí</span>
                            <span className="text-xs text-slate-400 ml-auto">[Nội bộ — không hiển thị cho khách]</span>
                        </div>
                        <div className="p-6">
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="py-3 text-slate-500">Giá hóa đơn (nhập)</td>
                                        <td className="py-3 text-right font-semibold text-slate-700">{vnd(product.invoicePrice)}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 text-slate-500">Giá thực tế (bán)</td>
                                        <td className="py-3 text-right font-bold text-emerald-600 text-base">{vnd(product.actualPrice)}</td>
                                    </tr>
                                    {margin !== null && (
                                        <tr>
                                            <td className="py-3 text-slate-500">Biên lợi nhuận</td>
                                            <td className="py-3 text-right">
                                                <span className={`font-bold text-sm px-2.5 py-0.5 rounded-lg ${parseFloat(margin) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                    {parseFloat(margin) >= 0 ? '+' : ''}{margin}%
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Inventory balances */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <span className="text-base font-bold text-slate-700">🏭 Tồn Kho Theo Kho / Cửa Hàng</span>
                        </div>
                        <div className="p-6">
                            {balances.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">
                                    Chưa có dữ liệu tồn kho cho sản phẩm này.
                                </p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                            <th className="pb-2 font-semibold">Loại kho</th>
                                            <th className="pb-2 font-semibold">Mã địa điểm</th>
                                            <th className="pb-2 text-right font-semibold">Tồn hiện tại</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {balances.map(b => (
                                            <tr key={b.id}>
                                                <td className="py-2.5">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${b.locationType === 'CENTRAL' ? 'bg-purple-50 text-purple-700' : b.locationType === 'STORE' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                                        {b.locationType}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 font-mono text-slate-600 text-xs">{b.locationId}</td>
                                                <td className="py-2.5 text-right">
                                                    <span className={`font-bold text-sm ${b.currentStock <= product.minStock ? 'text-red-600' : 'text-slate-800'}`}>
                                                        {b.currentStock.toLocaleString('vi-VN')}
                                                    </span>
                                                    {b.currentStock <= product.minStock && (
                                                        <span className="ml-2 text-[10px] text-red-400 font-medium">⚠️ Dưới mức tối thiểu</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── SIDE COLUMN (col-span-1) ───────────────────────────── */}
                <div className="space-y-5">
                    {/* QR Section — Client Component imported from co-located file */}
                    <QRDownloadSection sku={product.companyCode || product.barcode} />
                </div>

            </div>
        </div>
    );
}
