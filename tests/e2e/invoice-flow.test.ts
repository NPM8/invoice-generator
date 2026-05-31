// End-to-end: real API worker (wrangler dev) + local Supabase + the invoice
// worker's queue handler (in-process). Covers the full lifecycle:
// auth -> admin key mgmt -> org create -> invoice create -> read -> PDF (404)
// -> worker generates PDF -> PDF (200).
//
// Skips (does not fail) when Supabase isn't configured/reachable — see setup.ts.

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import {
    preflight,
    seedFixtures,
    startApiWorker,
    makeWorkerEnv,
    makeApiHandler,
    makeQueueBatch,
    makeCtx,
    type E2eConfig,
    type Fixtures,
    type RunningWorker,
} from "./helpers/setup.js"
import type { Env } from "../../src/shared/types/env.js"
import invoiceWorker from "../../src/invoice-worker/index.js"

const pf = await preflight()
if (!pf.available) console.warn(`[e2e] skipping: ${pf.reason}`)

describe.skipIf(!pf.available)(
    "E2E invoice lifecycle (wrangler dev + Supabase + invoice worker)",
    () => {
        const config = pf.config as E2eConfig
        let worker: RunningWorker
        let fx: Fixtures
        let invoiceId: string
        // Shared in-memory R2 env: the worker writes the PDF here, and the
        // in-process API handler serves the download from the same store.
        let workerEnv: Env

        beforeAll(async () => {
            fx = await seedFixtures(config)
            worker = await startApiWorker(config)
        }, 90_000)

        afterAll(async () => {
            worker?.stop()
            await fx?.cleanup()
        })

        // --- Auth ---------------------------------------------------------------

        it("rejects a request with no API key", async () => {
            const res = await fetch(`${config.baseUrl}/api/v1/invoices`)
            expect(res.status).toBe(401)
        })

        it("rejects a request with an invalid API key", async () => {
            const res = await fetch(`${config.baseUrl}/api/v1/invoices`, {
                headers: { "x-api-key": "inv_not_a_real_key_00000000" },
            })
            expect(res.status).toBe(401)
        })

        // --- Admin API-key management ------------------------------------------

        it("admin key can generate a new org-scoped API key", async () => {
            const res = await fetch(`${config.baseUrl}/admin/api-keys`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-api-key": fx.adminKey },
                body: JSON.stringify({
                    orgId: fx.orgId,
                    name: "Generated Key",
                    scopes: ["invoice:read", "invoice:write"],
                }),
            })
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.key).toStartWith("inv_")
            expect(body.scopes).toContain("invoice:write")
        })

        it("admin key can list API keys", async () => {
            const res = await fetch(`${config.baseUrl}/admin/api-keys`, {
                headers: { "x-api-key": fx.adminKey },
            })
            expect(res.status).toBe(200)
            const keys = await res.json() as any
            expect(Array.isArray(keys)).toBe(true)
            expect(keys.length).toBeGreaterThanOrEqual(2)
        })

        it("non-admin key is forbidden from admin endpoints", async () => {
            const res = await fetch(`${config.baseUrl}/admin/api-keys`, {
                headers: { "x-api-key": fx.orgKey },
            })
            expect(res.status).toBe(401)
        })

        // --- Organizations ------------------------------------------------------

        it("creates an organization over HTTP", async () => {
            const res = await fetch(`${config.baseUrl}/api/v1/organizations`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-api-key": fx.orgKey },
                body: JSON.stringify({
                    name: "Buyer Co",
                    legalName: "Buyer Co Ltd",
                    countryCode: "FR",
                }),
            })
            expect(res.status).toBe(200)
            const org = await res.json() as any
            expect(org.id).toBeDefined()
            expect(org.invoicePrefix).toBe("INV")
            fx.createdOrgIds.push(org.id) // ensure teardown removes it
        })

        // --- Invoice creation + reads ------------------------------------------

        it("creates an invoice (status pending) for the key's org", async () => {
            const res = await fetch(`${config.baseUrl}/api/v1/invoices`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-api-key": fx.orgKey },
                body: JSON.stringify({
                    buyerName: "Acme Buyer",
                    buyerAddress: "10 Buyer Ave, Paris",
                    buyerCountryCode: "FR",
                    currency: "EUR",
                    issueDate: "2026-01-15",
                    dueDate: "2026-02-15",
                    items: [
                        { position: 1, description: "Consulting", quantity: 10, unitPrice: 100, vatRate: 19 },
                        { position: 2, description: "Support", quantity: 1, unitPrice: 200, vatRate: 19 },
                    ],
                }),
            })
            expect(res.status).toBe(200)
            const inv = await res.json() as any
            expect(inv.id).toBeDefined()
            expect(inv.invoiceNumber).toStartWith("E2E-")
            expect(inv.status).toBe("pending")
            // 10*100 + 1*200 = 1200 net; +19% VAT = 1428 gross
            expect(inv.subtotal).toBe(1200)
            expect(inv.total).toBe(1428)
            invoiceId = inv.id
        })

        it("lists invoices including the created one", async () => {
            const res = await fetch(`${config.baseUrl}/api/v1/invoices`, {
                headers: { "x-api-key": fx.orgKey },
            })
            expect(res.status).toBe(200)
            const list = await res.json() as any
            expect(Array.isArray(list)).toBe(true)
            expect(list.some((i: { id: string }) => i.id === invoiceId)).toBe(true)
        })

        it("fetches the invoice with its line items", async () => {
            const res = await fetch(`${config.baseUrl}/api/v1/invoices/${invoiceId}`, {
                headers: { "x-api-key": fx.orgKey },
            })
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.invoice.id).toBe(invoiceId)
            expect(body.items.length).toBe(2)
        })

        it("returns 404 for the PDF URL before generation", async () => {
            const res = await fetch(`${config.baseUrl}/api/v1/invoices/${invoiceId}/pdf`, {
                headers: { "x-api-key": fx.orgKey },
            })
            expect(res.status).toBe(404)
        })

        // --- Async PDF path (invoice worker, in-process) -----------------------

        it("invoice worker generates the PDF and marks the invoice completed", async () => {
            const { env, r2 } = makeWorkerEnv(config)
            workerEnv = env
            const { batch, acked } = makeQueueBatch([{ type: "pdf-generation", invoiceId }])

            await invoiceWorker.queue(batch, env, makeCtx())

            // Job acknowledged, exactly one PDF stored at the expected R2 key.
            expect(acked).toEqual([0])
            expect(r2.puts.length).toBe(1)
            expect(r2.puts[0]!.key).toBe(`invoices/${fx.orgId}/${invoiceId}.pdf`)
            expect(r2.puts[0]!.size).toBeGreaterThan(0)
        }, 30_000)

        it("returns the PDF URL (download route) after generation", async () => {
            const res = await fetch(`${config.baseUrl}/api/v1/invoices/${invoiceId}/pdf`, {
                headers: { "x-api-key": fx.orgKey },
            })
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.url).toBe(`/api/v1/invoices/${invoiceId}/pdf/download`)
        })

        it("serves the PDF bytes from the download route (auth-scoped)", async () => {
            // Served in-process over the same in-memory R2 the worker wrote to.
            const api = makeApiHandler(workerEnv)

            const res = await api(
                new Request(`http://e2e/api/v1/invoices/${invoiceId}/pdf/download`, {
                    headers: { "x-api-key": fx.orgKey },
                }),
            )
            expect(res.status).toBe(200)
            expect(res.headers.get("content-type")).toContain("application/pdf")
            const buf = await res.arrayBuffer()
            expect(buf.byteLength).toBeGreaterThan(0)
            // PDF magic bytes "%PDF"
            expect(new Uint8Array(buf.slice(0, 4))).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]))
        })

        it("rejects PDF download without an API key", async () => {
            const api = makeApiHandler(workerEnv)
            const res = await api(
                new Request(`http://e2e/api/v1/invoices/${invoiceId}/pdf/download`),
            )
            expect(res.status).toBe(401)
        })

        // --- Bundled template selection (Path A) -------------------------------

        it("renders a non-default bundled template selected by templateId", async () => {
            // Create an invoice bound to the org-scoped "minimal" template.
            const createRes = await fetch(`${config.baseUrl}/api/v1/invoices`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-api-key": fx.orgKey },
                body: JSON.stringify({
                    templateId: fx.minimalTemplateId,
                    buyerName: "Acme Buyer",
                    buyerAddress: "10 Buyer Ave, Paris",
                    buyerCountryCode: "FR",
                    currency: "EUR",
                    issueDate: "2026-01-15",
                    dueDate: "2026-02-15",
                    items: [
                        { position: 1, description: "Design", quantity: 3, unitPrice: 250, vatRate: 19 },
                    ],
                }),
            })
            expect(createRes.status).toBe(200)
            const inv = await createRes.json() as any
            expect(inv.templateId).toBe(fx.minimalTemplateId)
            const minimalInvoiceId: string = inv.id

            // The invoice worker caches its ManagedRuntime (and the env it captured)
            // at module scope, so it always writes to `workerEnv`'s R2 regardless of
            // the env passed here. Reuse workerEnv and assert via the download route.
            const { batch, acked } = makeQueueBatch([{ type: "pdf-generation", invoiceId: minimalInvoiceId }])
            await invoiceWorker.queue(batch, workerEnv, makeCtx())
            expect(acked).toEqual([0])

            const api = makeApiHandler(workerEnv)
            const dl = await api(
                new Request(`http://e2e/api/v1/invoices/${minimalInvoiceId}/pdf/download`, {
                    headers: { "x-api-key": fx.orgKey },
                }),
            )
            expect(dl.status).toBe(200)
            const buf = await dl.arrayBuffer()
            expect(new Uint8Array(buf.slice(0, 4))).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]))
        }, 30_000)
    },
)
