'use client';

import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Package, SlidersHorizontal, Warehouse, ShoppingCart, Check, X, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { MergedProduct } from '@/app/(dashboard)/admin/inventory/overview/page';

interface ProductGridProps {
    merged: MergedProduct[];
    categories: string[];
    cartItemIds?: Set<string>;
    onAddToCart?: (product: MergedProduct) => void;
    onUpdateMinStock?: (productId: string, newMin: number) => void;
}

export function ProductGrid({
    merged,
    categories,
    cartItemIds = new Set(),
    onAddToCart,
    onUpdateMinStock
}: ProductGridProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'low' | 'out'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'stock_asc' | 'stock_desc' | 'name' | 'barcode'>('stock_asc');
    const [showFilters, setShowFilters] = useState(false);

    // Derive status counts for chips
    const safeCount = merged.filter(p => p.stockStatus === 'safe').length;
    const lowCount = merged.filter(p => p.stockStatus === 'low').length;
    const outCount = merged.filter(p => p.stockStatus === 'out').length;

    const filterTabs = [
        { key: 'all' as const, label: `Tất cả (${merged.length})` },
        { key: 'safe' as const, label: `An toàn (${safeCount})` },
        { key: 'low' as const, label: `Sắp hết (${lowCount})` },
        { key: 'out' as const, label: `Hết hàng (${outCount})` },
    ];

    // Apply filters + sort
    const filteredProducts = useMemo(() => {
        let rows = merged.filter((product) => {
            const matchesSearch =
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.barcode && product.barcode.includes(searchQuery)) ||
                (product.companyCode && product.companyCode.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesStatus = activeFilter === 'all' || product.stockStatus === activeFilter;
            const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
            return matchesSearch && matchesStatus && matchesCategory;
        });

        if (sortBy === 'name') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'barcode') rows = [...rows].sort((a, b) => (a.barcode || a.companyCode || '').localeCompare(b.barcode || b.companyCode || ''));
        else if (sortBy === 'stock_asc') rows = [...rows].sort((a, b) => a.currentStock - b.currentStock);
        else if (sortBy === 'stock_desc') rows = [...rows].sort((a, b) => b.currentStock - a.currentStock);

        return rows;
    }, [merged, searchQuery, activeFilter, selectedCategory, sortBy]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    };

    const statusConfig = {
        safe: {
            label: 'An toàn',
            className: 'bg-success-500/15 text-success-600 border-success-500/30',
            progressColor: 'bg-success-500',
        },
        low: {
            label: 'Sắp hết',
            className: 'bg-warning-500/15 text-warning-600 border-warning-500/30',
            progressColor: 'bg-warning-500',
        },
        out: {
            label: 'Hết hàng',
            className: 'bg-danger-500/15 text-danger-600 border-danger-500/30',
            progressColor: 'bg-danger-500',
        },
    };

    return (
        <div className="space-y-4">
            {/* Configuration Toolbar */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-surface-400" />
                        <Input
                            placeholder="Tìm kiếm theo tên, mã sản phẩm hoặc barcode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-surface-50 border-surface-200 focus-visible:ring-success-500"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowFilters(v => !v)}
                            className={cn(
                                "gap-2",
                                showFilters && "bg-surface-100"
                            )}
                        >
                            <SlidersHorizontal className="size-4" />
                            <span className="hidden sm:inline">Bộ lọc</span>
                        </Button>

                        <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                            <SelectTrigger className="w-[180px] bg-surface-50 border-surface-200 focus:ring-success-500">
                                <div className="flex items-center gap-2 text-surface-600">
                                    <ArrowUpDown className="size-4" />
                                    <SelectValue placeholder="Sắp xếp theo" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="stock_asc">Tồn kho thấp ↑</SelectItem>
                                <SelectItem value="stock_desc">Tồn kho cao ↓</SelectItem>
                                <SelectItem value="name">Tên sản phẩm A-Z</SelectItem>
                                <SelectItem value="barcode">Mã vạch A-Z</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Expanded Filters */}
                {showFilters && (
                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-surface-100">
                        {/* Status Tabs */}
                        <div className="flex flex-wrap items-center gap-2">
                            {filterTabs.map((tab) => (
                                <Button
                                    key={tab.key}
                                    variant={activeFilter === tab.key ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActiveFilter(tab.key)}
                                    className={cn(
                                        "rounded-full transition-colors",
                                        activeFilter === tab.key
                                            ? "bg-surface-800 text-white hover:bg-surface-700"
                                            : "text-surface-600 hover:text-surface-900 bg-transparent border-surface-200"
                                    )}
                                >
                                    {tab.label}
                                </Button>
                            ))}
                        </div>

                        <div className="hidden sm:block h-6 w-px bg-surface-200 mx-1" />

                        {/* Category Dropdown (better for scaling than chips) */}
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-[200px] h-9 text-xs rounded-full bg-surface-50">
                                <SelectValue placeholder="Chọn danh mục" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Mọi danh mục</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Grid Display */}
            {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-surface-200 border-dashed text-center mt-6">
                    <Warehouse className="size-12 text-surface-300 mx-auto" />
                    <h3 className="mt-4 text-base font-semibold text-surface-700">Không tìm thấy sản phẩm</h3>
                    <p className="mt-1 text-sm text-surface-500 max-w-sm">
                        Không có mặt hàng nào phù hợp với bộ lọc hiện tại. Thử thay đổi từ khóa hoặc xóa bớt cài đặt lọc.
                    </p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                            setSearchQuery('');
                            setActiveFilter('all');
                            setSelectedCategory('all');
                        }}
                    >
                        Xóa bộ lọc
                    </Button>
                </div>
            ) : (
                <>
                    <p className="text-xs text-surface-400 font-medium px-1">
                        Hiển thị {filteredProducts.length} / {merged.length} mặt hàng
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {filteredProducts.map((product) => (
                            <ProductGridCard
                                key={product.id}
                                product={product}
                                statusInfo={statusConfig[product.stockStatus]}
                                inCart={cartItemIds.has(product.id)}
                                onAddToCart={onAddToCart}
                                onUpdateMinStock={onUpdateMinStock}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Isolated Card Component ───────────────────────────────────────
function ProductGridCard({
    product,
    statusInfo,
    inCart,
    onAddToCart,
    onUpdateMinStock
}: {
    product: MergedProduct;
    statusInfo: { label: string; className: string; progressColor: string };
    inCart: boolean;
    onAddToCart?: (product: MergedProduct) => void;
    onUpdateMinStock?: (productId: string, newMin: number) => void;
}) {
    const [editingMin, setEditingMin] = useState(false);
    const [minValue, setMinValue] = useState(product.minStock);

    const fillDenominator = Math.max(product.minStock * 2, 1);
    const stockPercentage = Math.min((product.currentStock / fillDenominator) * 100, 100);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    };

    const handleSaveMin = () => {
        if (onUpdateMinStock) {
            onUpdateMinStock(product.id, minValue);
        }
        setEditingMin(false);
    };

    return (
        <Card className="group border-surface-200 shadow-sm overflow-hidden hover:shadow-md hover:border-success-200 transition-all flex flex-col relative">
            {/* Card Header/Image */}
            <div className="relative aspect-[4/3] bg-surface-100 overflow-hidden ring-1 ring-surface-900/5">
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <Package className="size-12 text-surface-300" />
                    </div>
                )}
                <span
                    className={cn(
                        "absolute right-2 top-2 rounded-md border px-2 py-0.5 text-[11px] font-bold shadow-sm backdrop-blur-md",
                        statusInfo.className
                    )}
                >
                    {statusInfo.label}
                </span>

                {/* In cart indicator overlay */}
                {inCart && (
                    <div className="absolute top-2 left-2 bg-accent-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-md">
                        <ShoppingCart className="w-2.5 h-2.5" /> Đã thêm
                    </div>
                )}
            </div>

            {/* Card Body */}
            <CardContent className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 text-xs mb-2">
                    <span className="font-bold text-surface-700 truncate" title={product.companyCode || product.barcode}>
                        {product.companyCode || product.barcode || '—'}
                    </span>
                    {product.category && (
                        <span className="rounded-full bg-surface-100 text-surface-600 px-2.5 py-0.5 font-medium shrink-0 truncate max-w-[100px]">
                            {product.category}
                        </span>
                    )}
                </div>

                <h3 className="font-semibold text-surface-800 text-sm leading-tight line-clamp-2 min-h-[2.5rem] mt-0.5 group-hover:text-success-700 transition-colors">
                    {product.name}
                </h3>

                <div className="mt-auto pt-4 space-y-3">
                    {/* Stock Text */}
                    <div className="flex items-end justify-between">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">Tồn kho</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className={cn("text-2xl font-black leading-none", product.stockStatus === 'out' ? 'text-danger-600' : product.stockStatus === 'low' ? 'text-warning-600' : 'text-success-600')}>
                                    {product.currentStock}
                                </span>
                                <span className="text-xs font-medium text-surface-500">{product.unit || 'cái'}</span>
                            </div>
                        </div>

                        {/* Editable Min Stock */}
                        <div className="text-right flex flex-col items-end">
                            <span className="text-[10px] text-surface-400">Tối thiểu</span>
                            {onUpdateMinStock ? (
                                editingMin ? (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <input
                                            type="number" min={0}
                                            value={minValue}
                                            onChange={e => setMinValue(Number(e.target.value))}
                                            className="w-14 text-xs text-center border border-accent-300 rounded-lg p-1 outline-none focus:ring-2 focus:ring-accent-300 bg-white"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveMin();
                                                if (e.key === 'Escape') { setEditingMin(false); setMinValue(product.minStock); }
                                            }}
                                        />
                                        <button onClick={handleSaveMin} className="text-success-600 hover:text-success-700">
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => { setEditingMin(false); setMinValue(product.minStock); }} className="text-surface-400 hover:text-surface-600">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-sm font-semibold text-surface-700">{product.minStock}</span>
                                        <button onClick={() => setEditingMin(true)} className="text-surface-300 hover:text-accent-500 transition-colors">
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                    </div>
                                )
                            ) : (
                                <p className="text-sm font-semibold text-surface-700 mt-0.5">{product.minStock}</p>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {product.minStock > 0 && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-100 ring-1 ring-inset ring-surface-900/5">
                            <div
                                className={cn("h-full transition-all duration-500 rounded-full", statusInfo.progressColor)}
                                style={{ width: `${stockPercentage}%` }}
                            />
                        </div>
                    )}

                    {/* Conditional Action Buttons or Footer Meta */}
                    {onAddToCart ? (
                        <div className="pt-1">
                            <button
                                onClick={() => onAddToCart(product)}
                                className={cn(
                                    "w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm",
                                    inCart
                                        ? "bg-accent-100 text-accent-700 border border-accent-200 hover:bg-accent-200"
                                        : "bg-gradient-to-r from-success-500 to-teal-500 hover:from-success-600 hover:to-teal-600 text-white shadow-success-500/20"
                                )}
                            >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                {inCart ? 'Đã trong giỏ' : 'Thêm vào giỏ'}
                            </button>
                        </div>
                    ) : (
                        <div className="border-t border-surface-100 pt-3 flex items-center justify-between text-[11px]">
                            <span className="text-surface-500">Giá nhập</span>
                            <span className="font-bold text-surface-700">{formatPrice(product.invoicePrice || 0)}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
