'use client';

import { useEffect } from 'react';
import type { ProductDoc } from '@/types/inventory';
import { LabelItem, type StyleConfig } from './LabelItem';

interface PrintableSheetProps {
    products: ProductDoc[];
    cols: number;
    rows: number;
    qrSize: number;
    styleConfig: StyleConfig;
    siteUrl: string;
    previewMode?: boolean;
}

function chunk<T>(arr: T[], size: number): T[][] {
    const pages: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        pages.push(arr.slice(i, i + size));
    }
    return pages;
}

export function PrintableSheet({
    products, cols, rows, qrSize, styleConfig, siteUrl, previewMode = false,
}: PrintableSheetProps) {
    const perPage = cols * rows;
    const pages = chunk(products, perPage);

    // BỘ CSS PRINT TỐI ƯU VÀ MẠNH NHẤT
    useEffect(() => {
        const id = 'jw-print-style';
        if (document.getElementById(id)) return;
        const style = document.createElement('style');
        style.id = id;
        style.innerHTML = `
            @media screen {
                .jw-print-only { display: none !important; }
            }
            @media print {
                /* 1. "Xóa sổ" toàn bộ khung Next.js (Sidebar, Topbar...) khỏi luồng in */
                body > *:not(.jw-print-only):not(:has(.jw-print-only)) {
                    display: none !important;
                }

                /* 2. Ép trình duyệt mở khóa chiều cao vô cực để đọc được n trang */
                html, body, :has(.jw-print-only) {
                    height: auto !important;
                    min-height: 100% !important;
                    overflow: visible !important;
                    background: white !important;
                }

                /* 3. Bản in PHẢI nằm ở luồng tĩnh (static), tuyệt đối không dùng absolute/fixed */
                .jw-print-only {
                    display: block !important;
                    position: static !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                /* 4. Khổ A4, lề 8mm */
                @page { 
                    size: A4 portrait; 
                    margin: 8mm; 
                }
            }
        `;
        document.head.appendChild(style);
        return () => { };
    }, []);

    const sheetStyle: React.CSSProperties = {
        width: previewMode ? '210mm' : '100%',
        fontFamily: 'sans-serif',
        backgroundColor: '#fff',
    };

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '4px',
        width: '100%',
    };

    const cellHeight = rows === 2 ? '135mm' : rows === 4 ? '68mm' : '38mm';

    const content = (
        <div style={sheetStyle}>
            {pages.map((pageProducts, pageIdx) => (
                <div
                    key={pageIdx}
                    style={{
                        // Ép ngắt trang chuẩn xác sau mỗi cụm (VD: cứ đủ 4 tem là ngắt)
                        pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto',
                        breakAfter: pageIdx < pages.length - 1 ? 'page' : 'auto',
                        paddingBottom: '2mm',
                    }}
                >
                    <div style={gridStyle}>
                        {pageProducts.map((product, idx) => (
                            <div key={`${product.id}-${idx}`} style={{ height: cellHeight }}>
                                <LabelItem
                                    product={product}
                                    styleConfig={styleConfig}
                                    qrSize={qrSize}
                                    siteUrl={siteUrl}
                                />
                            </div>
                        ))}
                        {/* Đệm các ô trống */}
                        {pageIdx === pages.length - 1 &&
                            Array.from({ length: perPage - pageProducts.length }).map((_, i) => (
                                <div
                                    key={`pad-${i}`}
                                    style={{
                                        border: '1px dashed #e5e7eb',
                                        borderRadius: '4px',
                                        backgroundColor: '#f9fafb',
                                        height: cellHeight,
                                    }}
                                />
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );

    if (previewMode) return content;

    return (
        <div className="jw-print-only" aria-hidden="true">
            {content}
        </div>
    );
}