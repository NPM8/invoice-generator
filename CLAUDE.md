---
description: Cloudflare Workers invoicing service with Effect.ts, Supabase, and R2.
globs: "*.ts, *.tsx, *.toml, package.json"
alwaysApply: false
---

## Agent Reference Doc

`AGENTS.md` is the working reference for this service (status, layout, known issues).
**Read it before starting work.** After completing any feature, re-evaluate `AGENTS.md`
and update any drifted section (status, architecture, known issues, commands, "Last reviewed" date).

## Runtime

This project runs on **Cloudflare Workers**. Two workers:
- `src/api-worker/` — HTTP API (fetch handler)
- `src/invoice-worker/` — Queue consumer (PDF generation, callbacks)

Use `wrangler` for dev and deploy:
- `wrangler dev --config wrangler.api.toml` — run API worker locally
- `wrangler dev --config wrangler.invoice.toml` — run invoice worker locally
- `wrangler deploy --config wrangler.api.toml` — deploy API
- `wrangler deploy --config wrangler.invoice.toml` — deploy invoice worker

## Testing

Use `bun test` to run tests (test runner only, not the runtime).

```ts#example.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Key Technology

- **Effect.ts** for DI, error handling, and functional composition
- **Supabase** (PostgreSQL) for database — queries use `@supabase/supabase-js`
- **Cloudflare R2** for PDF storage via R2 bindings
- **Cloudflare Queues** for async job processing
- **@react-pdf/renderer** for PDF generation
- **esbuild** for template pre-compilation (TSX -> JS)

## Architecture Notes

- Shared code lives in `src/shared/` (services, schemas, config, errors, types)
- Services use Effect Context Tags for dependency injection
- Config comes from Cloudflare env bindings (vars + secrets), not process.env
- Queue and Storage services accept CF bindings directly (`makeQueueService(env.INVOICE_QUEUE)`)
- No Redis, no BullMQ, no pino, no AWS SDK — all replaced by CF primitives
- Scripts (`src/scripts/`) still run via Bun locally for seeding and key generation
