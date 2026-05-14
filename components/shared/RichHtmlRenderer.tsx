'use client';

/**
 * RichHtmlRenderer.tsx
 * ─────────────────────────────────────────────────────────────
 * Renders AI-generated HTML content in a sandboxed iframe.
 * Auto-resizes to fit content height. No JS execution allowed.
 */

import { useRef, useEffect, useState, useCallback } from 'react';

interface RichHtmlRendererProps {
    html: string;
    className?: string;
}

/**
 * Detect if content looks like HTML (starts with <div or contains <style>)
 */
export function isHtmlContent(text: string): boolean {
    const trimmed = text.trim();
    return (
        trimmed.startsWith('<div') ||
        trimmed.startsWith('<style') ||
        (trimmed.includes('<div') && trimmed.includes('</div>')) ||
        (trimmed.includes('<style>') && trimmed.includes('</style>'))
    );
}

/**
 * Wrap raw HTML in a full document with base styling
 */
function wrapInDocument(html: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:'Inter','Segoe UI',system-ui,sans-serif;
    background:#f8fafc;
    color:#1e1b4b;
    padding:16px;
    line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:#c4b5fd;border-radius:4px}
</style>
</head>
<body>${html}</body>
</html>`;
}

export default function RichHtmlRenderer({ html, className }: RichHtmlRendererProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(300);

    const adjustHeight = useCallback(() => {
        const iframe = iframeRef.current;
        if (!iframe?.contentDocument?.body) return;
        const contentHeight = iframe.contentDocument.body.scrollHeight;
        setHeight(Math.min(Math.max(contentHeight + 32, 200), 800));
    }, []);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const handleLoad = () => {
            // Initial height adjust
            adjustHeight();
            // Re-adjust after fonts load
            setTimeout(adjustHeight, 300);
            setTimeout(adjustHeight, 800);
        };

        iframe.addEventListener('load', handleLoad);
        return () => iframe.removeEventListener('load', handleLoad);
    }, [adjustHeight]);

    const srcDoc = wrapInDocument(html);

    return (
        <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            sandbox="allow-same-origin"
            title="AI Analysis"
            className={className}
            style={{
                width: '100%',
                height,
                border: 'none',
                borderRadius: 12,
                background: '#f8fafc',
                transition: 'height 0.3s ease',
            }}
        />
    );
}
