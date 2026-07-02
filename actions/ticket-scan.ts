'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * Ticket Scan — Server Action Proxy to External Ticketing API
 * ═══════════════════════════════════════════════════════════════
 *
 * Proxies requests to the B.Duck Cityfuns Ticketing API.
 * Reads TICKET_API_URL and TICKET_API_KEY from process.env.
 * Returns null when the API is not configured (env vars missing).
 */

import type {
    TicketScanResponse,
    TicketUsePassResponse,
    TicketConfirmPaymentResponse,
} from '@/types';

function getConfig() {
    const url = process.env.TICKET_API_URL;
    const key = process.env.TICKET_API_KEY;
    if (!url || !key) return null;
    return { url: url.replace(/\/+$/, ''), key };
}

// ── 1. Lookup pass or order by any code ──────────────────────
export async function ticketLookupAction(
    code: string,
): Promise<TicketScanResponse> {
    const cfg = getConfig();
    if (!cfg) {
        return {
            success: false,
            error: 'TICKET_API_NOT_CONFIGURED',
            message: 'Chưa cấu hình TICKET_API_URL hoặc TICKET_API_KEY.',
        };
    }

    try {
        const res = await fetch(
            `${cfg.url}/scan?code=${encodeURIComponent(code)}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${cfg.key}`,
                    'Content-Type': 'application/json',
                },
                cache: 'no-store',
            },
        );
        let data: unknown;
        try {
            data = await res.json();
        } catch {
            return {
                success: false,
                error: 'TICKET_API_INVALID_RESPONSE',
                message: `API vé trả về phản hồi không phải JSON. Kiểm tra TICKET_API_URL (${res.status}).`,
                status: res.status,
            };
        }
        if (!res.ok && data && typeof data === 'object') {
            return { ...(data as Extract<TicketScanResponse, { success: false }>), status: res.status };
        }
        return data as TicketScanResponse;
    } catch (err) {
        console.error('[TicketScan] Lookup failed:', err);
        return {
            success: false,
            error: 'TICKET_API_NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Không thể kết nối API vé.',
        };
    }
}

// ── 2. Mark a pass as "used" (check-in) ─────────────────────
export async function ticketUsePassAction(
    passId: string,
): Promise<TicketUsePassResponse | null> {
    const cfg = getConfig();
    if (!cfg) return null;

    try {
        const res = await fetch(`${cfg.url}/scan/use-pass`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ passId }),
            cache: 'no-store',
        });
        const data = await res.json();
        return data as TicketUsePassResponse;
    } catch (err) {
        console.error('[TicketScan] Use-pass failed:', err);
        return null;
    }
}

// ── 3. Confirm counter payment ──────────────────────────────
export async function ticketConfirmPaymentAction(
    orderId: string,
    note?: string,
): Promise<TicketConfirmPaymentResponse | null> {
    const cfg = getConfig();
    if (!cfg) return null;

    try {
        const res = await fetch(`${cfg.url}/scan/confirm-payment`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId, ...(note ? { note } : {}) }),
            cache: 'no-store',
        });
        const data = await res.json();
        return data as TicketConfirmPaymentResponse;
    } catch (err) {
        console.error('[TicketScan] Confirm-payment failed:', err);
        return null;
    }
}
