/**
 * High-quality image compression utility optimized for CCCD (Vietnamese ID) KYC.
 *
 * Balances visual quality with file size:
 * - Target width: 1920px (sufficient for OCR and QR decoding)
 * - Format: WebP with JPEG fallback
 * - Quality: 0.85 (invisible loss, significantly smaller than raw)
 * - Safety cap: adaptive quality reduction if result exceeds Firestore's 1MB limit
 */

/** Target width for resized output (landscape). Height scales proportionally. */
const TARGET_WIDTH = 1920;

/** Encoding quality (0–1). 0.85 is the sweet spot for CCCD documents. */
const QUALITY = 0.85;

/** Max base64 string length (~750KB). Firestore doc limit is 1MB. */
const MAX_BASE64_LENGTH = 750_000;

/**
 * Compress an image from a File or base64 string into an optimized base64 WebP.
 *
 * @param fileOrBase64 - A `File` object or a `data:` base64 string.
 * @returns Optimized base64 data URL (WebP preferred, JPEG fallback).
 */
export function compressImage(fileOrBase64: File | string): Promise<string> {
    return new Promise((resolve, reject) => {
        // ── Convert File to base64 first ─────────────────────────
        if (fileOrBase64 instanceof File) {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    processBase64(reader.result).then(resolve).catch(reject);
                } else {
                    reject(new Error('FileReader did not produce a string'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(fileOrBase64);
            return;
        }

        // Already a base64 string
        processBase64(fileOrBase64).then(resolve).catch(reject);
    });
}

/** Internal: load base64 into Image → Canvas → compressed output */
function processBase64(base64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;

            // ── Smart resize: only downscale, never upscale ─────
            if (w > TARGET_WIDTH) {
                h = Math.round(h * (TARGET_WIDTH / w));
                w = TARGET_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas 2D context unavailable'));
                return;
            }

            // Enable high-quality downscaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            // ── Encode as WebP, fallback to JPEG ────────────────
            let result = canvas.toDataURL('image/webp', QUALITY);
            if (!result.startsWith('data:image/webp')) {
                // Browser doesn't support WebP canvas export
                result = canvas.toDataURL('image/jpeg', QUALITY);
            }

            // ── Safety: adaptive quality reduction if too large ──
            if (result.length > MAX_BASE64_LENGTH) {
                const fmt = result.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
                let q = 0.75;
                while (result.length > MAX_BASE64_LENGTH && q > 0.1) {
                    result = canvas.toDataURL(fmt, q);
                    q -= 0.1;
                }
            }

            resolve(result);
        };

        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = base64;
    });
}
