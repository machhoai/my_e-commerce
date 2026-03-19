/**
 * PUBLIC PRODUCT ROUTE — /p/[sku]
 *
 * Scanned by customers via QR code printed on product boxes.
 *
 * SECURITY CONTRACT:
 *   This page is a Server Component. All Firestore access happens on the
 *   server. The raw ProductDoc (which contains invoicePrice, actualPrice,
 *   minStock, etc.) is fetched server-side and IMMEDIATELY narrowed to the
 *   PublicProductView type below before any JSX rendering occurs.
 *
 *   ❌ NEVER pass price, cost, or inventory data to any JSX element here.
 *   ✅ Only the explicitly listed fields in PublicProductView are rendered.
 */

import { notFound } from 'next/navigation';
import { getAdminDb } from '@/lib/firebase-admin';
import type { ProductDoc } from '@/types/inventory';
import type { Metadata } from 'next';

// ── Safe public-facing shape ─────────────────────────────────────────────────
// This is the ONLY data structure that ever reaches the render tree.
// It is intentionally narrower than ProductDoc.
interface PublicProductView {
    sku: string;
    name: string;
    image: string;
    category: string;
    unit: string;
    origin: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Look up a product by companyCode (primary) or barcode (fallback).
 * The URL slug is never the raw Firestore document ID.
 */
async function getPublicProduct(sku: string): Promise<PublicProductView | null> {
    try {
        const db = getAdminDb();

        // Try companyCode first, then barcode
        let snap = await db
            .collection('products')
            .where('companyCode', '==', sku)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snap.empty) {
            snap = await db
                .collection('products')
                .where('barcode', '==', sku)
                .where('isActive', '==', true)
                .limit(1)
                .get();
        }

        if (snap.empty) return null;

        const doc = snap.docs[0];
        const raw = doc.data() as ProductDoc;

        // ── STRICT DATA STRIPPING ────────────────────────────────────────────
        // Only safe, public fields are returned — price/cost/stock never exposed.
        const safe: PublicProductView = {
            sku: raw.companyCode || raw.barcode || doc.id,
            name: raw.name,
            image: raw.image ?? '',
            category: raw.category ?? '',
            unit: raw.unit ?? '',
            origin: raw.origin ?? '',
        };

        return safe;
    } catch {
        return null;
    }
}

// ── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata(
    { params }: { params: Promise<{ sku: string }> }
): Promise<Metadata> {
    const { sku } = await params;
    const product = await getPublicProduct(sku);
    if (!product) return { title: 'Sản phẩm không tồn tại' };
    return {
        title: product.name,
        description: `${product.name} — ${product.category}`,
        openGraph: { images: product.image ? [product.image] : [] },
    };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function PublicProductPage(
    { params }: { params: Promise<{ sku: string }> }
) {
    const { sku } = await params;
    const product = await getPublicProduct(sku);

    if (!product) notFound();

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-start justify-center px-4 py-10">
            <article className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden">

                {/* Product Image */}
                <div className="relative w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-300 select-none">
                            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                                    d="M20 7l-8-4-8 4m16 0v10l-8 4m0-14L4 17m8 4V10" />
                            </svg>
                            <span className="text-sm font-medium">Chưa có ảnh</span>
                        </div>
                    )}
                    {/* SKU badge */}
                    <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-slate-500 text-[11px] font-mono px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                        {product.sku}
                    </span>
                </div>

                {/* Product Info */}
                <div className="p-6 space-y-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 leading-snug">
                            {product.name}
                        </h1>
                        {product.category && (
                            <span className="inline-block mt-2 bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full border border-blue-100">
                                {product.category}
                            </span>
                        )}
                    </div>

                    {/* Details grid */}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-slate-100">
                        {product.unit && (
                            <>
                                <dt className="text-xs text-slate-400 font-medium">Đơn vị tính</dt>
                                <dd className="text-sm font-semibold text-slate-700 text-right">{product.unit}</dd>
                            </>
                        )}
                        {product.origin && (
                            <>
                                <dt className="text-xs text-slate-400 font-medium">Xuất xứ</dt>
                                <dd className="text-sm font-semibold text-slate-700 text-right">{product.origin}</dd>
                            </>
                        )}
                    </dl>

                    {/* Footer trust badge */}
                    <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-100">
                        <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 1a9 9 0 100 18A9 9 0 0010 1zm3.707 7.293a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-slate-400">Sản phẩm chính hãng của <span className="font-bold text-slate-600">Joyworld</span></p>
                    </div>
                </div>
            </article>
        </main>
    );
}
