/**
 * Anthropic API Gateway — Cloudflare Worker
 * ─────────────────────────────────────────────────────────────
 * Proxy requests to Anthropic's Messages API.
 * Handles CORS, API key injection, and streaming passthrough.
 *
 * Endpoints:
 *   POST /v1/messages       → proxy to Anthropic Messages API
 *   GET  /health            → health check
 *   OPTIONS *               → CORS preflight
 *
 * Secrets (set via `wrangler secret put`):
 *   ANTHROPIC_API_KEY       → Your Anthropic API key
 *
 * Env vars (set in wrangler.toml):
 *   ALLOWED_ORIGINS         → Comma-separated allowed origins
 */

interface Env {
    ANTHROPIC_API_KEY: string;
    ALLOWED_ORIGINS: string;
}

const ANTHROPIC_BASE = 'https://1gw.gwai.cloud';
const ANTHROPIC_VERSION = '2023-06-01';

// ── CORS helpers ────────────────────────────────────────────

function getAllowedOrigins(env: Env): string[] {
    return (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
}

function isOriginAllowed(origin: string | null, env: Env): boolean {
    if (!origin) return false;
    const allowed = getAllowedOrigins(env);
    // Allow all if wildcard
    if (allowed.includes('*')) return true;
    return allowed.some(o => origin === o || origin.endsWith(o.replace('*', '')));
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
    const headers: HeadersInit = {
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-beta',
        'Access-Control-Max-Age': '86400',
    };
    if (origin && isOriginAllowed(origin, env)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

// ── Request handlers ────────────────────────────────────────

async function handleHealth(origin: string | null, env: Env): Promise<Response> {
    return new Response(
        JSON.stringify({
            status: 'ok',
            service: 'anthropic-gateway',
            timestamp: new Date().toISOString(),
            hasApiKey: !!env.ANTHROPIC_API_KEY,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders(origin, env),
            },
        }
    );
}

async function handleMessages(request: Request, env: Env, origin: string | null): Promise<Response> {
    // Prioritize API key from client request header, fallback to environment secret
    const clientApiKey = request.headers.get('x-api-key');
    const apiKey = clientApiKey || env.ANTHROPIC_API_KEY;

    // Validate API key exists
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'API Key not provided in header x-api-key and ANTHROPIC_API_KEY secret not configured on Cloudflare.' }),
            { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) } }
        );
    }

    // Read and forward the request body
    const body = await request.text();

    // Build upstream request
    const upstreamHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': request.headers.get('anthropic-version') || ANTHROPIC_VERSION,
    };

    // Forward anthropic-beta header if present (for prompt caching etc)
    const betaHeader = request.headers.get('anthropic-beta');
    if (betaHeader) {
        upstreamHeaders['anthropic-beta'] = betaHeader;
    }

    // Proxy to Anthropic
    const upstream = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
        method: 'POST',
        headers: upstreamHeaders,
        body,
    });

    // Determine if streaming
    const contentType = upstream.headers.get('Content-Type') || '';
    const isStreaming = contentType.includes('text/event-stream');

    // Build response headers
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType);

    // Copy relevant headers from upstream
    for (const key of ['x-request-id', 'request-id', 'anthropic-ratelimit-requests-limit',
        'anthropic-ratelimit-requests-remaining', 'anthropic-ratelimit-tokens-limit',
        'anthropic-ratelimit-tokens-remaining']) {
        const val = upstream.headers.get(key);
        if (val) responseHeaders.set(key, val);
    }

    // Add CORS
    const cors = corsHeaders(origin, env);
    for (const [k, v] of Object.entries(cors)) {
        responseHeaders.set(k, v);
    }

    if (isStreaming && upstream.body) {
        // Stream passthrough — pipe SSE directly
        return new Response(upstream.body, {
            status: upstream.status,
            headers: responseHeaders,
        });
    }

    // Non-streaming — forward JSON response
    const responseBody = await upstream.text();
    return new Response(responseBody, {
        status: upstream.status,
        headers: responseHeaders,
    });
}

// ── Main handler ────────────────────────────────────────────

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin');

        // CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(origin, env),
            });
        }

        // Route
        if (url.pathname === '/health' && request.method === 'GET') {
            return handleHealth(origin, env);
        }

        if (url.pathname === '/v1/messages' && request.method === 'POST') {
            return handleMessages(request, env, origin);
        }

        return new Response(
            JSON.stringify({
                error: 'Not found',
                usage: 'POST /v1/messages — Proxy to Anthropic Messages API',
            }),
            {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
            }
        );
    },
};
