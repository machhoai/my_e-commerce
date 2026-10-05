import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
// @ts-expect-error Node strip-types runner requires explicit extensions.
import { registerVietnameseFont } from '../../lib/pdf-font.ts';
// @ts-expect-error Node strip-types runner requires explicit extensions.
import { canvasToPNG, isIOSDevice, scheduleCanvasScale } from '../../lib/schedule-export.ts';

test('recognizes iPhone PWA and iPad desktop user agents without treating Macs as iPads', () => {
    assert.equal(isIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5), true);
    assert.equal(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 5), true);
    assert.equal(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 0), false);
    assert.equal(isIOSDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0), false);
});

test('wide and tall weekly schedules stay within iOS canvas area and side limits', () => {
    for (const [width, height] of [[3400, 1500], [3400, 8000], [1200, 500], [16000, 2000]]) {
        const scale = scheduleCanvasScale(width, height, true);
        assert.ok(scale > 0 && scale <= 2);
        assert.ok(Math.floor(width * scale) * Math.floor(height * scale) <= 3_000_000);
        assert.ok(width * scale <= 4096 && height * scale <= 4096);
    }
    assert.equal(scheduleCanvasScale(1200, 500, false), 2);
});

test('PNG conversion rejects failed canvas exports instead of silently downloading empty images', async () => {
    const failedCanvas = { toBlob: (callback: BlobCallback) => callback(null) } as HTMLCanvasElement;
    await assert.rejects(canvasToPNG(failedCanvas), /Không thể tạo ảnh/);
    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = { toBlob: (callback: BlobCallback) => callback(blob) } as HTMLCanvasElement;
    assert.equal(await canvasToPNG(canvas), blob);
});

test('font fetch retries after errors and embeds Vietnamese glyphs in regular and bold PDF text', async () => {
    const originalFetch = globalThis.fetch;
    let mode: 'http-error' | 'html' | 'font' = 'http-error';
    let requests = 0;
    globalThis.fetch = async input => {
        requests++;
        if (mode === 'http-error') return new Response('Not found', { status: 404 });
        if (mode === 'html') return new Response('<html>Offline fallback</html>');
        const filename = String(input).split('/').pop();
        const bytes = await readFile(new URL(`../../public/fonts/${filename}`, import.meta.url));
        return new Response(bytes);
    };
    try {
        await assert.rejects(registerVietnameseFont(new jsPDF()), /Không thể tải font/);
        mode = 'html';
        await assert.rejects(registerVietnameseFont(new jsPDF()), /Font PDF không hợp lệ/);
        mode = 'font';
        const doc = new jsPDF();
        await registerVietnameseFont(doc);
        const label = 'Lịch Tổng Quan Tuần Nguyễn Thị Hồng Quản lý Cửa hàng trưởng';
        for (const style of ['normal', 'bold']) {
            doc.setFont('Roboto', style);
            assert.equal(doc.getFont().fontName, 'Roboto');
            assert.equal(doc.getFont().fontStyle, style);
            const font = doc.getFont().metadata as unknown as { characterToGlyph: (code: number) => number };
            for (const char of label) assert.ok(font.characterToGlyph(char.charCodeAt(0)) > 0, `${style}: ${char}`);
        }
        autoTable(doc, {
            head: [['Nhân viên', 'Quầy / Ngày']],
            body: [['Nguyễn Thị Hồng', 'Cửa hàng trưởng']],
            styles: { font: 'Roboto' },
            headStyles: { fontStyle: 'bold' },
        });
        doc.setFont('Roboto', 'normal');
        doc.text(label, 14, 60);
        const pdf = doc.output();
        assert.equal((pdf.match(/\/ToUnicode/g) || []).length, 2);
        assert.ok(pdf.includes('/FontFile2'));
        const requestsAfterLoad = requests;
        const secondDoc = new jsPDF();
        await registerVietnameseFont(secondDoc);
        assert.equal(requests, requestsAfterLoad);
        assert.ok(secondDoc.getFontList().Roboto.includes('bold'));
    } finally {
        globalThis.fetch = originalFetch;
    }
});
