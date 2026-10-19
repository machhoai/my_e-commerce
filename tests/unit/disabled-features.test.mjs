import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as disabledFeatures from '../../lib/disabled-features.ts';

const { DISABLED_PAGE_PATHS, isDisabledPage, activePermissions, activeDefaultRoute } = disabledFeatures;

// Execute the actual middleware with Next's response helpers replaced by HTTP responses.
const require = createRequire(import.meta.url);
const middlewareModule = { exports: {} };
const source = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
class MockResponse extends Response {
    static next() { return new MockResponse(null, { status: 200 }); }
    static redirect(url) { return new MockResponse(null, { status: 307, headers: { location: url.href } }); }
    static rewrite(url) { return new MockResponse(null, { status: 200, headers: { 'x-rewrite': url.href } }); }
}
runInNewContext(compiled, {
    exports: middlewareModule.exports,
    require: name => {
        if (name === 'next/server') return { NextResponse: MockResponse };
        if (name === '@/lib/disabled-features') return disabledFeatures;
        if (name === '@/lib/routing') return { PROTECTED_ROUTE_PREFIXES: ['/admin', '/office', '/manager'] };
        return require(name);
    },
    URL,
});
const { middleware } = middlewareModule.exports;

for (const route of DISABLED_PAGE_PATHS) {
    test(`blocks ${route} across devices, child routes, sessions and roles`, () => {
        for (const prefix of ['', '/desktop', '/mobile']) {
            for (const suffix of ['', '/', '/detail?tab=all']) {
                for (const role of ['', 'employee', 'admin', 'super_admin']) {
                    const url = new URL(`https://example.test${prefix}${route}${suffix}`);
                    const response = middleware({
                        nextUrl: url,
                        url: url.href,
                        cookies: { get: key => role ? { value: key === 'session' ? 'session' : role } : undefined },
                    });
                    assert.equal(response.status, 404, `${url.pathname}: ${role}`);
                    assert.equal(response.headers.get('cache-control'), 'no-store');
                }
            }
        }
    });
}

test('keeps active sibling pages and unrelated APIs available to routing', () => {
    for (const path of ['/admin/inventory/stock', '/admin/inventory/import',
        '/admin/products/categories', '/manager/inventory/receive', '/office/tracking',
        '/dashboard', '/api/inventory/products', '/api/external/revenue', '/admin/events-archive']) {
        assert.equal(isDisabledPage(path), false, path);
    }
});

test('ignores stored retired grants while preserving shared inventory and scanner permissions', () => {
    const grants = ['page.greensm.promotion', 'action.greensm.settings', 'page.admin.events',
        'page.admin.vouchers', 'action.voucher.revoke', 'page.office.approvals', 'action.office.approve',
        'page.products', 'action.manager.order',
        'page.admin.daily_report', 'page.office.revenue', 'page.manager.inventory',
        'page.admin.inventory', 'page.products.categories', 'search_vouchers', 'scan_tickets'];
    assert.deepEqual(activePermissions(grants), [
        'page.manager.inventory', 'page.admin.inventory', 'page.products.categories',
        'search_vouchers', 'scan_tickets',
    ]);
    assert.equal(grants.length, 16, 'does not mutate the stored grants');
});

test('removes retired default routes including device URLs and query strings', () => {
    for (const route of DISABLED_PAGE_PATHS) {
        assert.equal(activeDefaultRoute(`/mobile${route}?view=all`), null);
        assert.equal(activeDefaultRoute(`/desktop${route}/detail`), null);
    }
    assert.equal(activeDefaultRoute('/dashboard'), '/dashboard');
    assert.equal(activeDefaultRoute(undefined), null);
});
