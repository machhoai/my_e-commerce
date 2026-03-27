import { Html5Qrcode } from 'html5-qrcode';
import { parseCCCDQR, CCCDParsedData } from './cccd';

// ── Constants ────────────────────────────────────────────────────────────────

/** ID card aspect ratio (width / height): ~1.58 for ISO/IEC 7810 ID-1 */
const ASPECT_RATIO_MIN = 1.2;
const ASPECT_RATIO_MAX = 1.9;

/** Glare: % of near-white pixels to flag */
const GLARE_THRESHOLD_PCT = 5;
const GLARE_CHANNEL_MIN = 245;

/** Blur: Laplacian variance threshold (lower = blurrier) */
const BLUR_VARIANCE_THRESHOLD = 15;

/** Max canvas width for quality analysis (performance) */
const ANALYSIS_MAX_WIDTH = 640;

// ── Hidden container ID for file-based QR scanning ──────────────────────────
const QR_SCAN_CONTAINER_ID = 'cccd-validation-qr-scan';

// ── Task 1: QR Code Validation ──────────────────────────────────────────────

/**
 * Validate an image file to ensure it contains a readable CCCD QR code.
 * Returns parsed CCCD data on success, `null` on failure.
 */
export async function validateQRCodeImage(file: File): Promise<CCCDParsedData | null> {
    // Ensure the hidden container exists
    let container = document.getElementById(QR_SCAN_CONTAINER_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = QR_SCAN_CONTAINER_ID;
        container.style.display = 'none';
        document.body.appendChild(container);
    }

    const scanner = new Html5Qrcode(QR_SCAN_CONTAINER_ID, { verbose: false });

    try {
        const result = await scanner.scanFileV2(file, /* showImage */ true);
        scanner.clear();
        return parseCCCDQR(result.decodedText);
    } catch {
        try { scanner.clear(); } catch { /* ignore */ }
        return null;
    }
}

// ── Task 2: ID Card Aspect Ratio Check ──────────────────────────────────────

/**
 * Validate that the image has a landscape aspect ratio consistent with an ID card.
 * Rejects portrait, square, and extreme aspect ratios.
 */
export function validateIDCardDimensions(imageSource: string): Promise<boolean> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;

            // Reject if vertical or square
            if (h >= w) {
                resolve(false);
                return;
            }

            const ratio = w / h;
            resolve(ratio >= ASPECT_RATIO_MIN && ratio <= ASPECT_RATIO_MAX);
        };
        img.onerror = () => resolve(false);
        img.src = imageSource;
    });
}

// ── Task 3: Glare & Blur Detection ──────────────────────────────────────────

export interface ImageQualityResult {
    hasGlare: boolean;
    isBlurry: boolean;
}

/**
 * Detect glare (overexposed regions) and blur (lack of edge detail) in an image.
 * Uses Canvas pixel analysis for a lightweight, client-side heuristic.
 */
export function detectImageQuality(imageSource: string): Promise<ImageQualityResult> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Scale down for performance
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > ANALYSIS_MAX_WIDTH) {
                h = Math.round(h * (ANALYSIS_MAX_WIDTH / w));
                w = ANALYSIS_MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve({ hasGlare: false, isBlurry: false });
                return;
            }

            ctx.drawImage(img, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const pixels = imageData.data; // RGBA flat array

            // ── Glare check ─────────────────────────────────────────
            const totalPixels = w * h;
            let whiteCount = 0;

            // Sample every 4th pixel for speed (still statistically significant)
            for (let i = 0; i < pixels.length; i += 16) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                if (r > GLARE_CHANNEL_MIN && g > GLARE_CHANNEL_MIN && b > GLARE_CHANNEL_MIN) {
                    whiteCount++;
                }
            }

            const sampledTotal = Math.ceil(totalPixels / 4);
            const whitePct = (whiteCount / sampledTotal) * 100;
            const hasGlare = whitePct > GLARE_THRESHOLD_PCT;

            // ── Blur check (Laplacian variance) ─────────────────────
            // Convert to grayscale, then compute Laplacian (discrete second derivative)
            const gray = new Float32Array(totalPixels);
            for (let i = 0; i < totalPixels; i++) {
                const idx = i * 4;
                // ITU-R BT.601 luminance
                gray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            }

            // Laplacian kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
            let laplacianSum = 0;
            let laplacianSqSum = 0;
            let count = 0;

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;
                    const lap = (
                        gray[idx - w] +          // top
                        gray[idx + w] +          // bottom
                        gray[idx - 1] +          // left
                        gray[idx + 1] -          // right
                        4 * gray[idx]            // center
                    );
                    laplacianSum += lap;
                    laplacianSqSum += lap * lap;
                    count++;
                }
            }

            const mean = laplacianSum / count;
            const variance = (laplacianSqSum / count) - (mean * mean);
            const isBlurry = variance < BLUR_VARIANCE_THRESHOLD;

            resolve({ hasGlare, isBlurry });
        };
        img.onerror = () => resolve({ hasGlare: false, isBlurry: false });
        img.src = imageSource;
    });
}

// ── Validation Error Messages ───────────────────────────────────────────────

export const VALIDATION_MESSAGES = {
    INVALID_QR: 'Không tìm thấy mã QR hợp lệ. Vui lòng đảm bảo ảnh rõ nét và không bị chói.',
    INVALID_DIMENSIONS: 'Vui lòng tải lên ảnh thẻ CCCD nằm ngang hợp lệ, không dùng ảnh chân dung.',
    GLARE_DETECTED: 'Ảnh bị chói sáng quá mức, vui lòng chụp lại.',
    BLURRY_IMAGE: 'Ảnh bị mờ, vui lòng chụp lại rõ nét hơn.',
} as const;
