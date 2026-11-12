// Nine HTTP checks plus one mobile browser navigation, within the approved trial.
// Does not log in, call AI providers, or read/write business data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

async function main() {
    const base = process.argv[2];
    assert.match(base || '', /^https:\/\/jw-erp-trial[-.a-z0-9]*\.run\.app$/);
    const output = path.resolve('outputs/cloud-run-trial');
    fs.mkdirSync(output, { recursive: true });
    const results = [];
    const checks = [
        { path: '/login', status: 200 },
        { path: '/api/chat', method: 'POST', status: 410, code: 'AI_DISABLED' },
        { path: '/api/ai-usage', status: 410, code: 'AI_DISABLED' },
        { path: '/greensm', status: 404 },
        { path: '/mobile/admin/vouchers', status: 404 },
        { path: '/sw.js', status: 200, worker: true },
        { path: '/firebase-messaging-sw.js', status: 200, worker: true },
        { path: '/api/auth/session', status: 401 },
        { path: '/api/cron/attendance-sync', status: 503 },
    ];
    for (const check of checks) {
        const response = await fetch(base + check.path, {
            method: check.method || 'GET',
            headers: { 'User-Agent': 'CloudRunTrialSmokeDesktop' },
            ...(check.method === 'POST' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
            redirect: 'manual',
            signal: AbortSignal.timeout(60000),
        });
        assert.equal(response.status, check.status, check.path);
        if (check.code) assert.equal((await response.json()).code, check.code);
        if (check.worker) assert.match(response.headers.get('cache-control') || '', /max-age=0/);
        if (check.path === '/sw.js') assert.equal(response.headers.get('service-worker-allowed'), '/');
        results.push({ path: check.path, method: check.method || 'GET', status: response.status });
        console.log('PASS', check.path, response.status);
    }
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
            serviceWorkers: 'block',
        });
        // Allow application assets; block external integrations and every API.
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')) return route.abort();
            return route.continue();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const response = await page.goto(base + '/login', { waitUntil: 'networkidle', timeout: 60000 });
        assert.equal(response.status(), 200);
        await page.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 20000 });
        await page.screenshot({ path: path.join(output, 'login-mobile.png'), fullPage: true });
        results.push({ path: '/login', check: 'mobile-browser', status: response.status(), pageErrors: errors });
        fs.writeFileSync(path.join(output, 'smoke-results.json'), JSON.stringify({ base, checks: results }, null, 2));
        assert.deepEqual(errors, [], 'Unhandled browser errors');
        console.log('PASS mobile login rendered; no login submitted');
    } finally {
        await browser.close();
    }
    fs.writeFileSync(path.join(output, 'smoke-results.json'), JSON.stringify({ base, checks: results }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
