import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const bundle = readFileSync(new URL('./bundle.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
let nextEvent = 'CHECK_IN';
let punches = 0;
let waitUntil = null;
const events = [];
await page.addInitScript(() => {
    window.process = { env: {} };
    window.qaLocation = 'valid';
    let success, failure;
    const position = () => ({ coords: { latitude: 10.8, longitude: window.qaLocation === 'outside' ? 107 : 106.6, accuracy: window.qaLocation === 'inaccurate' ? 200 : 5 }, timestamp: window.qaLocation === 'stale' ? Date.now() - 180000 : Date.now() });
    window.updateLocation = () => {
        if (window.qaLocation === 'denied') failure({ code: 1, PERMISSION_DENIED: 1 });
        else success(position());
    };
    Object.defineProperty(navigator, 'geolocation', { value: {
        watchPosition: (ok, fail) => { success = ok; failure = fail; setTimeout(window.updateLocation, 10); return 1; },
        clearWatch: () => {},
        getCurrentPosition: (ok) => setTimeout(() => ok(position()), 10),
    } });
});
await page.route('http://localhost:4177/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/context')) {
        return route.fulfill({ json: {
            canPunch: true, reason: 'READY', message: 'Sẵn sàng chấm công', attendanceDate: '2026-10-19', serverTime: new Date().toISOString(),
            nextEventType: nextEvent, checkOutAvailableAt: waitUntil, locationRequired: true,
            store: { id: 'qa-store', name: 'Quận Tây Hồ' },
            policy: { verificationMethod: 'GPS', gps: { latitude: 10.8, longitude: 106.6, radiusM: 150, maxAccuracyM: 80, maxAgeSeconds: 120 } }, todayEvents: events,
        } });
    }
    if (url.pathname.includes('/punch')) {
        punches++;
        const body = route.request().postDataJSON();
        if (body.eventType !== nextEvent || !body.location || !body.idempotencyKey) throw new Error('Invalid punch payload');
        const event = { id: `event-${punches}`, eventType: nextEvent, method: 'GPS', occurredAt: new Date().toISOString() };
        events.push(event); nextEvent = 'CHECK_OUT'; waitUntil = new Date(Date.now() + 2000).toISOString();
        await new Promise(r => setTimeout(r, 250));
        return route.fulfill({ json: { event } });
    }
    return route.fulfill({ contentType: 'text/html', body: `<html><meta charset="UTF-8"><style>${css} body{font-family:Arial;background:#f1f5f9;padding:12px;color:#172033}#root{max-width:480px;margin:auto}</style><div id="root"></div><script>${bundle}</script></html>` });
});
await page.goto('http://localhost:4177/');
await page.waitForTimeout(500);

let button = page.getByRole('button', { name: /Vào ca/ });
await expect(button).toBeEnabled();
await button.click(); await button.dblclick();
await page.waitForTimeout(200);
if (punches !== 0) throw new Error('Tap or double tap punched');
await button.hover(); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
await page.waitForTimeout(1000);
if (punches !== 0) throw new Error('Short hold punched');
for (const [mode, message] of [['outside','ngoài bán kính'], ['inaccurate','chưa đủ chính xác'], ['stale','quá cũ'], ['denied','chưa cho phép']]) {
    await page.evaluate(mode => { window.qaLocation = mode; window.updateLocation(); }, mode);
    await expect(button).toBeDisabled(); await expect(page.getByRole('status')).toContainText(message);
}
await page.evaluate(() => { window.qaLocation = 'valid'; window.updateLocation(); });
await expect(button).toBeEnabled();
await button.hover(); await page.mouse.down();
await page.waitForTimeout(600);
await page.evaluate(() => { window.qaLocation = 'outside'; window.updateLocation(); });
await page.waitForTimeout(1200); await page.mouse.up();
if (punches !== 0) throw new Error('GPS lost mid-hold still punched');
await page.evaluate(() => { window.qaLocation = 'valid'; window.updateLocation(); });
await expect(button).toBeEnabled();
await page.waitForTimeout(250);
console.log('Button color:', await button.evaluate(el => getComputedStyle(el).backgroundColor));
await page.screenshot({ path: 'outputs/attendance-dashboard-qa/ready.png', fullPage: true });
await button.hover(); await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
await expect(page.getByRole('button', { name: /Ra ca/ })).toBeDisabled();
if (punches !== 1) throw new Error(`Expected exactly one punch; got ${punches}`);
await expect(page.getByText(/thành công lúc/)).toBeVisible();
await expect(page.getByRole('button', { name: /Ra ca/ })).toBeEnabled({ timeout: 6000 });
await page.screenshot({ path: 'outputs/attendance-dashboard-qa/checkout.png', fullPage: true });
button = page.getByRole('button', { name: /Ra ca/ });
await button.focus(); await page.keyboard.down('Space'); await page.waitForTimeout(1600); await page.keyboard.up('Space');
await expect.poll(() => punches).toBe(2);
nextEvent = 'CHECK_IN'; punches = 0; waitUntil = null; events.length = 0;
await page.reload();
button = page.getByRole('button', { name: /Vào ca/ });
await expect(button).toBeEnabled();
const bounds = await button.boundingBox();
const cdp = await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
await page.waitForTimeout(1700);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await expect.poll(() => punches).toBe(1);
if (errors.length) throw new Error(errors.join('\n'));
console.log('PASS: tap/double tap, short hold, GPS outside/inaccurate/stale/denied, GPS loss mid-hold, hold once, checkout transition/cooldown, keyboard hold, touchscreen hold.');
await browser.close();
