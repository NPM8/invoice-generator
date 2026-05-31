# Deploy

Two Cloudflare Workers:
- **`invoicing-api`** (`wrangler.api.toml`) — public HTTP API (the only public surface).
- **`invoicing-worker`** (`wrangler.invoice.toml`) — queue consumer (PDF generation, callbacks); no URL.

Other apps integrate by calling the API worker over HTTPS with `x-api-key`.

## Automated (recommended)

```bash
cp .env.deploy.example .env.deploy   # fill in (gitignored — holds secrets)
bunx wrangler login                  # or set CLOUDFLARE_API_TOKEN in .env.deploy
bun run deploy:all
```
`deploy:all` (`src/scripts/deploy.ts`) creates the R2 bucket + queues, applies
migrations (`supabase db push` over a direct DB connection), sets the wrangler
secrets (piped via stdin — never in argv), deploys both workers, and bootstraps
an admin org + API key — **printed once at the end**. Idempotent; safe to re-run.
Prereqs below (Workers Paid plan, hosted Supabase) still apply.

The manual steps below document what the script does.

## Prerequisites
- Cloudflare account; `bunx wrangler login`.
- **Workers Paid plan** ($5/mo) — Cloudflare Queues require it. Enable **R2** in the dashboard.
- A hosted **Supabase** project (Postgres) — the local stack is for dev/e2e only.

## 1. Create resources (once)
```bash
bunx wrangler r2 bucket create invoices
bunx wrangler queues create invoice-processing
bunx wrangler queues create invoice-processing-dlq
```
Names must match the bindings in `wrangler.api.toml` / `wrangler.invoice.toml`.

## 2. Database
```bash
bunx supabase link --project-ref <your-project-ref>
bunx supabase db push          # applies supabase/migrations 001–003
```
Bootstrap one admin API key (no unauthenticated key-creation route):
insert an `api_keys` row with `key_hash` = SHA-256 of a raw `inv_...` key and
`scopes` containing `"admin"`. Procedure: `tests/e2e/helpers/setup.ts`.

## 3. Secrets
```bash
# API worker
bunx wrangler secret put SUPABASE_URL              --config wrangler.api.toml
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.api.toml
bunx wrangler secret put ADMIN_API_KEY             --config wrangler.api.toml
# Invoice worker
bunx wrangler secret put SUPABASE_URL              --config wrangler.invoice.toml
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.invoice.toml
```
`LOG_LEVEL` / `NODE_ENV` are plain `[vars]` in the toml; the rest are secrets.

## 4. Deploy
```bash
bun run deploy:api        # -> https://invoicing-api.<account>.workers.dev
bun run deploy:worker     # queue consumer; binds the same queue + R2
```
Pre-deploy sanity: `bunx tsc --noEmit` clean, `bun test` green.

## 5. Expose to other apps
- **Per-app keys:** `POST /admin/api-keys` (admin key) → mint an `inv_...` key per consumer.
- **Contract:** share `API.md` + `openapi.json` (generate a typed client from the spec if useful).
- **CORS:** enabled (`HttpMiddleware.cors()`); restrict origins later if needed.
- **Custom domain** (instead of `*.workers.dev`) — add to `wrangler.api.toml` and redeploy:
  ```toml
  routes = [{ pattern = "api.yourdomain.com", custom_domain = true }]
  ```

### Consumer example
```bash
curl https://invoicing-api.<account>.workers.dev/api/v1/invoices \
  -H "x-api-key: inv_xxx" -H "content-type: application/json" \
  -d '{"buyerName":"Acme","buyerAddress":"...","buyerCountryCode":"FR","currency":"EUR","issueDate":"2026-01-15","dueDate":"2026-02-15","items":[{"position":1,"description":"X","quantity":1,"unitPrice":100,"vatRate":20}]}'
```

## Notes / gotchas
- **Logos** (`logoUrl`) must be a fetchable HTTPS URL or data-URI at render time (host in R2/CDN), not a local path.
- Fonts are embedded in the bundle (`src/templates/fonts.data.ts`) — no runtime font fetch.
- Verify producer↔consumer wiring after first deploy: API enqueues to `invoice-processing`, the invoice worker consumes it.
- `wrangler tail --config wrangler.api.toml` to watch logs.
