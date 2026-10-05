/** iPadOS can identify itself as a Mac, so include its touch capability. */
export function isIOSDevice(userAgent: string, maxTouchPoints: number): boolean {
    return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Keep a complete weekly table below conservative iOS canvas limits. */
export function scheduleCanvasScale(width: number, height: number, ios: boolean): number {
    const maxPixels = ios ? 3_000_000 : 16_000_000;
    const maxSide = ios ? 4096 : 16384;
    return Math.min(2, Math.sqrt(maxPixels / (width * height)), maxSide / width, maxSide / height);
}

export function canvasToPNG(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob && blob.size > 0) resolve(blob);
            else reject(new Error('Không thể tạo ảnh lịch làm việc. Vui lòng thử xuất PDF.'));
        }, 'image/png');
    });
}

export function downloadExport(file: File): void {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Safari may consume the URL after the click handler has returned.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
