import type jsPDF from 'jspdf';

let fontDataPromise: Promise<string[]> | null = null;
const fonts = [
    { file: 'Roboto-Regular.ttf', style: 'normal' },
    { file: 'Roboto-Bold.ttf', style: 'bold' },
];

/**
 * Convert ArrayBuffer to base64 string (chunk-safe for large fonts).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
}

/**
 * Load and register a Vietnamese-compatible font (Roboto) with jsPDF.
 * Caches the font data after first load for subsequent exports.
 */
export async function registerVietnameseFont(doc: jsPDF): Promise<void> {
    if (!fontDataPromise) {
        fontDataPromise = Promise.all(fonts.map(async ({ file }) => {
            const res = await fetch(`/fonts/${file}`);
            if (!res.ok) throw new Error(`Không thể tải font PDF (${res.status}). Vui lòng thử lại.`);
            const buffer = await res.arrayBuffer();
            // Reject HTML/offline fallback responses before caching them as fonts.
            if (buffer.byteLength < 4 || new DataView(buffer).getUint32(0) !== 0x00010000) {
                throw new Error('Font PDF không hợp lệ. Vui lòng tải lại ứng dụng và thử lại.');
            }
            return arrayBufferToBase64(buffer);
        })).catch(error => {
            fontDataPromise = null;
            throw error;
        });
    }

    const data = await fontDataPromise;
    fonts.forEach(({ file, style }, index) => {
        doc.addFileToVFS(file, data[index]);
        doc.addFont(file, 'Roboto', style);
    });
    doc.setFont('Roboto', 'normal');
}
