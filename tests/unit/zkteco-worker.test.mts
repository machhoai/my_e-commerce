import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { fetchZkLogs, fetchZkUsers } from '../../lib/zkteco-worker.ts';

test('bridge migration routes reads and the new key together without changing device selection', async (t) => {
    t.mock.method(globalThis, 'fetch', async (input, init) => {
        assert.equal(input, 'https://cloud-bridge.example/api/zkteco/logs?device_id=store-01-zk');
        assert.equal(new Headers(init?.headers).get('X-Api-Key'), 'new-bridge-key');
        assert.equal(init?.cache, 'no-store');
        return new Response(JSON.stringify([{ user_id: 'employee-1' }]), { status: 200 });
    });
    const original = { ...process.env };
    try {
        process.env.ZKTECO_WORKER_URL_OVERRIDE = 'https://cloud-bridge.example/';
        process.env.ZKTECO_API_KEY = 'new-bridge-key';
        const logs = await fetchZkLogs('https://old-render.example', 'store-01-zk');
        assert.deepEqual(logs, [{ user_id: 'employee-1' }]);
    } finally { process.env = original; }
});

test('deployments without a migration override retain their existing device endpoint', async (t) => {
    t.mock.method(globalThis, 'fetch', async (input, init) => {
        assert.equal(input, 'https://old-render.example/api/zkteco/users?device_id=store-01-zk');
        assert.equal(new Headers(init?.headers).get('X-Api-Key'), 'old-bridge-key');
        return new Response('[]', { status: 200 });
    });
    const original = { ...process.env };
    try {
        delete process.env.ZKTECO_WORKER_URL_OVERRIDE;
        process.env.ZKTECO_WORKER_URL = 'https://fallback.example';
        process.env.ZKTECO_API_KEY = 'old-bridge-key';
        await fetchZkUsers('https://old-render.example', 'store-01-zk');
    } finally { process.env = original; }
});

test('bridge failure never sends the new key to the previous provider as a fallback', async (t) => {
    let attempts = 0;
    t.mock.method(globalThis, 'fetch', async (input) => {
        attempts += 1;
        assert.equal(input, 'https://cloud-bridge.example/api/zkteco/logs?device_id=store-01-zk');
        return new Response('Device operation already in progress.', { status: 409 });
    });
    const original = { ...process.env };
    try {
        process.env.ZKTECO_WORKER_URL_OVERRIDE = 'https://cloud-bridge.example';
        await assert.rejects(fetchZkLogs('https://old-render.example', 'store-01-zk'), /\[409\]/);
        assert.equal(attempts, 1);
    } finally { process.env = original; }
});
