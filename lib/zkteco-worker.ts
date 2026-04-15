/**
 * lib/zkteco-worker.ts
 *
 * Server-only thin client for the ZKTeco FastAPI bridge worker.
 * Every exported function reads ZKTECO_WORKER_URL and ZKTECO_API_KEY
 * from environment variables — never hardcoded.
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

function getWorkerConfig(): { baseUrl: string; apiKey: string } {
    const baseUrl =
        process.env.ZKTECO_WORKER_URL?.replace(/\/$/, '') ?? 'http://localhost:8001';
    const apiKey = process.env.ZKTECO_API_KEY ?? '';
    return { baseUrl, apiKey };
}

async function workerFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const { baseUrl, apiKey } = getWorkerConfig();
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
export async function fetchZkUsers(): Promise<ZkRawUser[]> {
    return workerFetch<ZkRawUser[]>('/api/zkteco/users');
}

/** Fetch all attendance punch logs from the ZKTeco device */
export async function fetchZkLogs(): Promise<ZkRawLog[]> {
    return workerFetch<ZkRawLog[]>('/api/zkteco/logs');
}
