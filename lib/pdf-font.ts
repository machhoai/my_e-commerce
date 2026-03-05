import jsPDF from 'jspdf';

let fontLoaded = false;
let fontBase64: string | null = null;

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
    if (!fontBase64) {
        const res = await fetch('/fonts/Roboto-Regular.ttf');
        const buffer = await res.arrayBuffer();
        fontBase64 = arrayBufferToBase64(buffer);
    }

    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
    fontLoaded = true;
}
