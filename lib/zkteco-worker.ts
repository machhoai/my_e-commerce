/**
 * lib/zkteco-worker.ts
 *
 * Server-only thin client for the ZKTeco FastAPI bridge worker.
 * The bridge endpoint comes from attendance_devices. The shared API key remains
 * server-only in ZKTECO_API_KEY and is never stored in Firestore.
 *
 * Usage (in a Next.js Route Handler):
 *   import { fetchZkUsers } from '@/lib/zkteco-worker';
 *   const users = await fetchZkUsers();
 */

export interface ZkRawUser {
    uid: number;
    name: string;
    privilege: number;
    password: string;
    group_id: string;
    user_id: string; // Card/employee number
}

export interface ZkRawLog {
    uid: number;
    user_id: string; // Card/employee number
    timestamp: string; // ISO-ish string from device e.g. "2025-04-15 08:30:22"
    status: number;
    punch: number; // Raw punch type (0-5)
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function getWorkerConfig(baseUrlOverride?: string): { baseUrl: string; apiKey: string } {
    const baseUrl = (baseUrlOverride
        ?? process.env.ZKTECO_WORKER_URL
        ?? 'http://localhost:8001').replace(/\/$/, '');
    const apiKey = process.env.ZKTECO_API_KEY ?? '';
    return { baseUrl, apiKey };
}

async function workerFetch<T>(path: string, baseUrlOverride?: string, init?: RequestInit): Promise<T> {
    const { baseUrl, apiKey } = getWorkerConfig(baseUrlOverride);
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            ...(init?.headers ?? {}),
        },
        // Don't cache — always fetch live from device
        cache: 'no-store',
    });

    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`ZKTeco worker error [${res.status}] ${path}: ${text}`);
    }

    return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch all users enrolled on the ZKTeco device */
export async function fetchZkUsers(
    bridgeEndpoint?: string,
    deviceId?: string,
): Promise<ZkRawUser[]> {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return workerFetch<ZkRawUser[]>(`/api/zkteco/users${query}`, bridgeEndpoint);
}

/** Fetch all attendance punch logs from the ZKTeco device */
export async function fetchZkLogs(
    bridgeEndpoint?: string,
    deviceId?: string,
): Promise<ZkRawLog[]> {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return workerFetch<ZkRawLog[]>(`/api/zkteco/logs${query}`, bridgeEndpoint);
}
