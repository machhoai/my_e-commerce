import 'server-only';

import crypto from 'node:crypto';

export type WmsApiResponse<T> = {
    success: boolean;
    data: T;
    error?: string;
    messages?: { vi?: string; zh?: string };
};

export function getWmsApiUrl() {
    return (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
}

export function buildWmsAuthHeaders(method: string, path: string, rawBody = '') {
    const apiKey = process.env.WMS_API_KEY || '';
    const apiSecret = process.env.WMS_API_SECRET || '';
    const headers: Record<string, string> = { 'x-api-key': apiKey };

    if (apiSecret) {
        const timestamp = Date.now().toString();
        headers['x-timestamp'] = timestamp;
        headers['x-signature'] = crypto
            .createHmac('sha256', apiSecret)
            .update(`${method.toUpperCase()}|${path}|${timestamp}|${rawBody}`)
            .digest('hex');
    }

    return headers;
}

export function fetchWmsApi(path: string, init: RequestInit = {}) {
    const method = (init.method || 'GET').toUpperCase();
    const rawBody = typeof init.body === 'string' ? init.body : '';
    const suppliedHeaders = Object.fromEntries(new Headers(init.headers).entries());

    return fetch(`${getWmsApiUrl()}${path}`, {
        ...init,
        headers: {
            ...buildWmsAuthHeaders(method, path, rawBody),
            ...suppliedHeaders,
        },
    });
}

export function getWmsResponseError(result: Partial<WmsApiResponse<unknown>>, fallback: string) {
    return result.messages?.vi || result.error || fallback;
}
