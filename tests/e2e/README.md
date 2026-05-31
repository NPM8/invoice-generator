# E2E tests

Full-stack lifecycle test: the real API worker (via `wrangler dev`) against a
local Supabase, plus the invoice worker's queue handler invoked in-process.

Covered: API-key auth (reject no/invalid key) → admin key generate/list →
non-admin forbidden → org create → invoice create (VAT math) → list → fetch
with items → PDF 404 before generation → **worker renders + stores PDF** →
PDF URL 200 after.

## Prerequisites

- Docker running (Supabase local stack).
- `wrangler` (already a dev dependency).

## Run

```bash
# 1. Start local Supabase (first run pulls images). Applies supabase/migrations.
bunx supabase start          # or: bunx supabase db reset  to reapply migrations

# 2. Get the API URL + secret (service-role) key
bunx supabase status

# 3. Run, pointing at the local stack
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<secret key from status> \
WRANGLER_SEND_METRICS=false CI=1 \
bun test tests/e2e
```

`bun` auto-loads a `.env` file, so you can instead put `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` there and just run `bun test tests/e2e`.

Optional: `E2E_PORT` (default `8799`), `ADMIN_API_KEY` (unused by auth; defaults
to a dummy).

## Skipping

If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset or Supabase is
unreachable, the suite **skips** (does not fail) — so `bun test` stays green in
environments without the stack. The harness logs the skip reason.

## How it works

- `helpers/setup.ts` — preflight/skip, seeds an org + global default template +
  admin & org API keys directly via the service-role client, spawns
  `wrangler dev`, and builds an in-process `Env` (real DB + in-memory R2 capture)
  for the worker. Fixtures are cleaned up in `afterAll`.
- The async PDF path is exercised by calling `invoiceWorker.queue(batch, env, ctx)`
  directly (local `wrangler dev` queue consumers don't bridge across processes),
  asserting the PDF was written to R2 and the invoice marked completed.
