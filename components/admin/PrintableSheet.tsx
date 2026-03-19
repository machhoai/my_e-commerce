'use client';

import { useEffect } from 'react';
import type { ProductDoc } from '@/types/inventory';
import { LabelItem, type StyleConfig } from './LabelItem';

interface PrintableSheetProps {
    products: ProductDoc[];
    cols: number;
    rows: number;
    qrSize: number;
    fontSize: number;
    logoHeight: number;
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
    products, cols, rows, qrSize, fontSize, logoHeight, styleConfig, siteUrl, previewMode = false,
}: PrintableSheetProps) {
    const perPage = cols * rows;
    const pages = chunk(products, perPage);

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
                /* ẨN TOÀN BỘ KHUNG GIAO DIỆN CỦA WEB */
                body > *:not(.jw-print-root) { 
                    display: none !important; 
                }
                
                body > .jw-print-root { 
                    display: block !important; 
                }

                /* HỦY DIỆT MODAL NẾU TAILWIND CHƯA LÀM SẠCH */
                .jw-screen-only, .print\\:hidden {
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
                
                /* MỞ KHÓA CHIỀU CAO ĐỂ TRÌNH DUYỆT TÍNH TOÁN NHIỀU TRANG */
                html, body {
                    height: auto !important;
                    min-height: 100% !important;
                    overflow: visible !important;
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                /* ĐẶT BẢN IN LÊN GÓC TRÊN CÙNG BÊN TRÁI CỦA GIẤY */
                .jw-print-only {
                    display: block !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                }

                /* KHỔ GIẤY A4, LỀ AN TOÀN 8mm */
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

    const cellHeight = rows === 2 ? '135mm' : rows === 3 ? '90mm' : rows === 4 ? '68mm' : '38mm';

    const content = (
        <div style={sheetStyle}>
            {pages.map((pageProducts, pageIdx) => (
                <div
                    key={pageIdx}
                    style={{
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
                                    fontSize={fontSize}
                                    logoHeight={logoHeight}
                                    siteUrl={siteUrl}
                                />
                            </div>
                        ))}
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