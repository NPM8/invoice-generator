# AGENTS.md — Invoicing Service Reference

> Working reference for AI agents on this repo. Read before touching code.
> **Maintenance rule:** After every completed feature, re-evaluate this document
> and update any section that drifted (status, architecture, known issues, commands).
> Stale reference is worse than none.

Last reviewed: 2026-05-31 (typecheck clean + e2e passing end-to-end — see §6)

---

## 1. What this is

PDF invoicing service running on **Cloudflare Workers**. Two deployables:

| Worker | Entry | Trigger | Job |
|--------|-------|---------|-----|
| `invoicing-api` | `src/api-worker/index.ts` | HTTP `fetch` | REST API (CRUD invoices, orgs, templates, admin) |
| `invoicing-worker` | `src/invoice-worker/index.ts` | Queue consumer | PDF generation + callback delivery |

Both share `src/shared/` (services, schemas, errors, config, types).

---

## 2. Migration context — READ THIS FIRST

Repo is **mid-migration** from a Bun/Node stack to Cloudflare Workers. Old stack
(BullMQ + Redis + AWS S3 SDK + pino + standalone HTTP server) is **deleted** and
replaced by CF primitives (Queues + R2 + env bindings + console logging).

The migration is **structurally complete and now typechecks clean** (`bunx tsc --noEmit` → 0). See §6.

Git: migration work is uncommitted on `main`. Deleted files (`src/api/`,
`src/worker/`, `index.ts`, `devenv.*`) are the old stack — do not resurrect.

---

## 3. Tech stack

- **Effect.ts** (`effect` ^3.19) — DI via `Context.Tag`, error handling, composition
- **@effect/platform** — `HttpApi*` declarative API definition
- **Supabase** (`@supabase/supabase-js`) — Postgres, service-role key
- **Cloudflare R2** — PDF storage via R2 binding (`INVOICES_BUCKET`)
- **Cloudflare Queues** — async jobs (`INVOICE_QUEUE`, consumer `invoice-processing`, DLQ)
- **@react-pdf/renderer** + React 19 — PDF rendering
- **esbuild** — pre-compile template TSX → JS (stored in `invoice_templates.compiled_code`)
- **Bun** — test runner + local scripts ONLY (not the runtime)

---

## 4. Layout

```
src/
  api-worker/        HTTP API worker
    index.ts         fetch handler (caches HttpApiBuilder web handler)
    api.ts           HttpApi.make — composes 4 groups
    groups/          endpoint declarations (invoices, templates, organizations, admin)
    handlers/        endpoint implementations (HttpApiBuilder.group)
    middleware/      auth (x-api-key), admin-auth
    layers/          DI wiring — makeCoreLayer(env)
  invoice-worker/    Queue consumer worker
    index.ts         queue() handler, ack/retry w/ exponential backoff
    processors/      pdf-generation, callback-delivery
    services/        pdf (react-pdf), template-compiler (esbuild)
    layers/          makeWorkerLayer(env)
  shared/
    config/          ConfigService — built from env bindings, NOT process.env
    errors/          Data.TaggedError classes (see §6 known issue)
    schemas/         Effect Schema models (invoice, organization, template, api-key, job, common)
    services/        database, invoice, organization, template, api-key, callback, storage, queue, logger, vat
    types/           env.ts (CF bindings), queue-messages.ts
  templates/         default-invoice.tsx + shared components (header/footer/items/vat/payment)
  scripts/           seed.ts, generate-api-key.ts (run via Bun)
supabase/migrations/ 001_initial_schema.sql, 002_cloudflare_migration.sql
tests/               unit/, integration/, e2e/
```

CF bindings passed into service constructors directly:
`makeStorageService(env.INVOICES_BUCKET)`, `makeQueueService(env.INVOICE_QUEUE)`,
`makeConfigServiceFromEnv(env)`.

---

## 5. Commands

```bash
bun install
bun run dev:api          # wrangler dev --config wrangler.api.toml
bun run dev:worker       # wrangler dev --config wrangler.invoice.toml
bun run deploy:api
bun run deploy:worker
bun test                 # all tests (transpiles, does NOT typecheck)
bun run test:unit | test:integration | test:e2e | test:coverage
bun run seed             # src/scripts/seed.ts
bun run generate-key     # src/scripts/generate-api-key.ts
bunx tsc --noEmit        # TYPECHECK — currently fails, see §6
```

Secrets via `wrangler secret put`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ADMIN_API_KEY` (api worker only).

---

## 6. Status — done vs not done

### Done
- Two-worker CF structure scaffolded; both entry points wired with cached runtime/handler.
- Shared services rewired to CF: R2 storage, CF Queues, env-binding config, console logger.
- Queue consumer: batch loop, ack on success, `retry()` with exponential backoff (cap 300s, max 8 retries, DLQ).
- HttpApi declared (4 groups) + handlers + DI layers. Auth via `AuthMiddleware`/`AdminAuthMiddleware`
  (`.middleware(...)` on groups), API key passed as `Redacted`.
- Effect Schemas, errors (now `Schema.TaggedError`), React-PDF templates.
- `wrangler.api.toml` + `wrangler.invoice.toml` (R2 + queue bindings).
- Migration SQL `002` (add `compiled_code`, drop `bullmq_job_id`).
- **`bunx tsc --noEmit` → 0 errors** (was 141). Tests: **36 pass / 0 fail** (unit + integration + e2e).
- **PDF download works:** R2 bindings can't presign, so PDFs are served by an auth-scoped route
  `GET /api/v1/invoices/:id/pdf/download` (success = `HttpApiSchema.Uint8Array`, `application/pdf`).
  `StorageService.getPdf` reads R2; `InvoiceService.getPdfContent` verifies org ownership + derives the
  key `invoices/{orgId}/{id}.pdf`. `getSignedUrl` returns this route (stored as `pdf_url`).
- **Real e2e** (`tests/e2e/`): drives the API worker via `wrangler dev` against local Supabase +
  invokes the invoice worker in-process; covers auth → admin keys → org → invoice → PDF render → PDF URL.
  Skips cleanly when Supabase isn't configured. Run instructions: `tests/e2e/README.md`.
  Bringing the e2e up green surfaced + fixed real runtime bugs (see "Runtime bugs found by e2e").

### Runtime bugs found by e2e (now fixed)
- `template.ts` statically imported `esbuild` → API worker crashed on boot (esbuild can't run on
  Workers). Made the import lazy inside `precompile`.
- Response schemas used `Schema.DateFromString` (Type = `Date`) but services return DB timestamp
  **strings** → every record 400'd on encode. Timestamps are now `Schema.String` (wire = ISO string).
- `invoices` table missing columns the code uses: added `seller_tax_id_type`, `buyer_tax_id_type`,
  `pdf_generated_at`; renamed `callback_last_attempt` → `callback_last_attempt_at`
  (migration `003_invoice_tax_id_types.sql`).
- `computeVatSummary` dropped `vatType`, but the `VatSummaryEntry` schema requires it → now carried through.
- Invoice-worker layer provided infra (Storage/Queue/Logger) inward only; processors yield them
  directly → "Service not found". Now `provideMerge`d so infra is re-exported.
- Template styles used numeric `border`/`borderTop`/`borderBottom` (react-pdf needs `*Width`) →
  "Invalid border style: 1". Switched to `borderWidth`/`borderTopWidth`/`borderBottomWidth`.

### NOT done / broken
- **Custom template compilation is stubbed on Workers:** `invoice-worker/services/template-compiler.ts`
  `compile()` throws — runtime eval / `URL.createObjectURL` don't exist on CF Workers. Only the built-in
  default template renders (non-default templates short-circuit via `template.isDefault`). See the
  `TODO(workers)` in that file: real fix needs build-time/per-org bundled modules. `compileTemplateCode`
  (esbuild transform at create/update time) still works.
- **README is stale** — default `bun init` boilerplate (`bun run index.ts` no longer exists).
- No deploy has been run/verified against real CF account (e2e uses local `wrangler dev` + Supabase only).
- PDF custom-template path still stubbed on Workers (template-compiler `TODO(workers)`); default template renders fine.

### How the 141 typecheck errors were cleared (reference for similar work)
1. `shared/errors/index.ts`: `Data.TaggedError` → `Schema.TaggedError` (unblocked all `.addError()`/`failure:`).
2. `tsconfig.json` `types`: added `@types/bun` alongside `@cloudflare/workers-types` (fixed `bun:test`,
   `Bun`, `process`, node modules in tests + scripts; the two type sets coexist thanks to `skipLibCheck`).
3. Service impls: returned object annotated `Context.Tag.Service<TheTag>` so method params infer (kills TS7006).
4. `invoice.ts create`: `QueueError` contained via `Effect.catchTag` → DatabaseError (kept public channel stable).
5. API groups: dropped bogus `HttpApiSecurity.apiKey` class/`annotateContext`, used `.middleware(AuthMiddleware)`.
6. DI layers: `Layer.provideMerge(OrganizationServiceLive, TemplateServiceLive)` so `InvoiceService` deps resolve.
7. `api-worker/index.ts`: merge `HttpServer.layerContext` for `DefaultServices`; `HttpMiddleware.cors()` (called).

### Suggested next steps (priority)
1. Decide custom-template strategy (or drop custom templates) — see template-compiler `TODO(workers)`.
2. Update README. First real deploy against a CF account.

---

## 7. Conventions

- Functional / Effect-first. DI through `Context.Tag` + `Layer`. No classes for logic.
- Config from env bindings, never `process.env` (scripts excepted).
- Tests: WET (explicit, repeated setup over shared abstraction) per repo style.
- `bun test` transpiles only — **always run `bunx tsc --noEmit` before claiming done.**
