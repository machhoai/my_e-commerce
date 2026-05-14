# Anthropic API Gateway (Cloudflare Worker)

Proxy for Anthropic Claude API — handles CORS, API key, and streaming.

## Setup

```bash
cd workers/anthropic-gateway
npm install
```

## Configure Secret

```bash
# Set Anthropic API key (stored encrypted in Cloudflare)
npx wrangler secret put ANTHROPIC_API_KEY
# Paste your API key when prompted
```

## Update allowed origins

Edit `wrangler.toml`:
```toml
[vars]
ALLOWED_ORIGINS = "http://localhost:3000,https://your-domain.com"
```

## Deploy

```bash
npx wrangler deploy
```

After deploy, you'll get a URL like:
```
https://anthropic-gateway.<your-account>.workers.dev
```

## Connect to Next.js

Add to `.env.local`:
```env
ANTHROPIC_GATEWAY_URL=https://anthropic-gateway.<your-account>.workers.dev/v1
ANTHROPIC_API_KEY=sk-ant-...
```

## Test

```bash
# Health check
curl https://anthropic-gateway.<your-account>.workers.dev/health

# Local dev
npx wrangler dev
curl http://localhost:8787/health
```

## Local development

```bash
npx wrangler dev
# Worker runs at http://localhost:8787
```
