'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { ProductDoc } from '@/types/inventory';

export interface StyleConfig {
    showLogo: boolean;
    showName: boolean;
    showSku: boolean;
    showPublicUrlText: boolean;
}

interface LabelItemProps {
    product: ProductDoc;
    styleConfig: StyleConfig;
    qrSize: number;
    siteUrl: string;
}

export function LabelItem({ product, styleConfig, qrSize, siteUrl }: LabelItemProps) {
    const slug = product.companyCode || product.barcode || '';
    const publicUrl = `${siteUrl}/p/${slug}`;

    return (
        <div
            style={{
                border: '1px dashed #9ca3af',
                borderRadius: '4px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                height: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                fontFamily: 'sans-serif',
            }}
        >
            {/* Logo */}
            {styleConfig.showLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src="/logo.png"
                    alt="Joyworld"
                    style={{ height: '18px', objectFit: 'contain', maxWidth: '80px' }}
                />
            )}

            {/* Product Name */}
            {styleConfig.showName && (
                <p style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    textAlign: 'center',
                    lineHeight: 1.25,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    color: '#111827',
                    margin: 0,
                }}>
                    {product.name}
                </p>
            )}

            {/* QR Code */}
            <QRCodeSVG
                value={slug ? publicUrl : 'https://joyworld.vn'}
                size={qrSize}
                level="M"
                marginSize={1}
            />

            {/* SKU / Company Code */}
            {styleConfig.showSku && slug && (
                <p style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    color: '#374151',
                    letterSpacing: '0.05em',
                    fontFamily: 'monospace',
                    margin: 0,
                }}>
                    {slug}
                </p>
            )}

            {/* Public URL text */}
            {styleConfig.showPublicUrlText && slug && (
                <p style={{
                    fontSize: '6px',
                    color: '#6b7280',
                    textAlign: 'center',
                    wordBreak: 'break-all',
                    maxWidth: '100%',
                    margin: 0,
                }}>
                    {publicUrl}
                </p>
            )}
        </div>
    );
}
