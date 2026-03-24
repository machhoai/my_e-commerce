/**
 * Convert a base64 image (any format) to WebP using an offscreen canvas.
 * Returns a `data:image/webp;base64,...` string.
 */
export function convertBase64ToWebP(
    base64Src: string,
    quality = 0.8
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
                ctx.drawImage(img, 0, 0);
                const webp = canvas.toDataURL('image/webp', quality);
                resolve(webp);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64Src;
    });
}
