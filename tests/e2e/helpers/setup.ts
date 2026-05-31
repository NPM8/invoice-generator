// E2E harness: drives the real API worker via `wrangler dev` against a local
// Supabase, and invokes the invoice worker's queue handler in-process for the
// async PDF path.
//
// REQUIRED ENV (bun auto-loads `.env`):
//   SUPABASE_URL                 e.g. http://127.0.0.1:54321
//   SUPABASE_SERVICE_ROLE_KEY    local service-role key
//   ADMIN_API_KEY                optional (defaults to a dummy; not used by auth)
//   E2E_PORT                     optional wrangler dev port (default 8799)
//
// If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset or Supabase is
// unreachable, the suite SKIPS (it does not fail) — see tests/e2e/README.md.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { HttpApiBuilder, HttpServer } from "@effect/platform"
import { Layer } from "effect"
import { makeCoreLayer } from "../../../src/api-worker/layers/index.js"
import type { Env } from "../../../src/shared/types/env.js"
import type { QueueMessage } from "../../../src/shared/types/queue-messages.js"

export interface E2eConfig {
    supabaseUrl: string
    supabaseServiceRoleKey: string
    adminApiKey: string
    port: number
    baseUrl: string
}

export interface Preflight {
    available: boolean
    reason?: string
    config?: E2eConfig
}

/** Env presence + a quick Supabase reachability probe. Decides skip vs run. */
export async function preflight(): Promise<Preflight> {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        return {
            available: false,
            reason: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (see tests/e2e/README.md)",
        }
    }

    try {
        await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: { apikey: supabaseServiceRoleKey },
            signal: AbortSignal.timeout(3000),
        })
    } catch (e) {
        return { available: false, reason: `Supabase unreachable at ${supabaseUrl}: ${(e as Error).message}` }
    }

    const port = Number(process.env.E2E_PORT ?? 8799)
    return {
        available: true,
        config: {
            supabaseUrl,
            supabaseServiceRoleKey,
            adminApiKey: process.env.ADMIN_API_KEY ?? "e2e-admin-key",
            port,
            baseUrl: `http://127.0.0.1:${port}`,
        },
    }
}

/** Service-role client (bypasses RLS) for seeding + assertions. */
export function adminDb(config: E2eConfig): SupabaseClient {
    return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}

/** SHA-256 hex — must match src/shared/services/api-key.ts hashKey(). */
const sha256hex = async (s: string): Promise<string> => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
}

export interface Fixtures {
    orgId: string
    templateId: string // global default template
    minimalTemplateId: string // org-scoped bundled "minimal" template
    bekimTemplateId: string // org-scoped bundled "bekim-minimal" template
    adminKey: string // raw key, has "admin" scope
    orgKey: string // raw key, scopes invoice:read/write only
    createdOrgIds: string[] // orgs created during the run (for cleanup)
    cleanup: () => Promise<void>
}

/**
 * Seeds the bootstrap org, a global default template, and two API keys
 * (admin + org-scoped) directly in Supabase. Returns the raw keys (only ever
 * available at creation) plus a cleanup function.
 */
export async function seedFixtures(config: E2eConfig): Promise<Fixtures> {
    const db = adminDb(config)

    // Idempotency: clear leftovers from a prior interrupted run.
    // Deleting the org cascades its api_keys + invoices (+ items, jobs).
    // The key prefixes below are constant per run, so also drop any orphaned
    // keys whose owning org wasn't cleaned (key_prefix has a UNIQUE index).
    await db.from("api_keys").delete().in("key_prefix", ["inv_adm_", "inv_org_"])
    await db.from("organizations").delete().eq("name", "E2E Test Org")
    await db.from("invoice_templates").delete().eq("name", "E2E Default Template")

    const { data: org, error: orgErr } = await db
        .from("organizations")
        .insert({
            name: "E2E Test Org",
            legal_name: "E2E Test Org Ltd",
            address_line1: "1 Test Street",
            city: "Berlin",
            postal_code: "10115",
            country_code: "DE",
            tax_id: "DE123456789",
            tax_id_type: "eu_vat",
            default_currency: "EUR",
            invoice_prefix: "E2E",
        })
        .select()
        .single()
    if (orgErr) throw new Error(`seed org failed: ${orgErr.message}`)

    // Global default template. component_code is NOT NULL; the default render
    // path uses the bundled React component, so this value is just a placeholder.
    const { data: tpl, error: tplErr } = await db
        .from("invoice_templates")
        .insert({
            org_id: null,
            name: "E2E Default Template",
            is_default: true,
            status: "active",
            component_code: "export default () => null",
        })
        .select()
        .single()
    if (tplErr) throw new Error(`seed template failed: ${tplErr.message}`)

    // Org-scoped non-default template whose name matches a bundled component
    // (templates/registry.ts) so the worker selects MinimalInvoice.
    const { data: minimalTpl, error: minimalErr } = await db
        .from("invoice_templates")
        .insert({
            org_id: org.id,
            name: "minimal",
            is_default: false,
            status: "active",
            component_code: "export default () => null",
        })
        .select()
        .single()
    if (minimalErr) throw new Error(`seed minimal template failed: ${minimalErr.message}`)

    const { data: bekimTpl, error: bekimErr } = await db
        .from("invoice_templates")
        .insert({
            org_id: org.id,
            name: "bekim-minimal",
            is_default: false,
            status: "active",
            component_code: "export default () => null",
        })
        .select()
        .single()
    if (bekimErr) throw new Error(`seed bekim template failed: ${bekimErr.message}`)

    // Distinct 8-char prefixes ("inv_adm_" / "inv_org_") to satisfy the unique
    // key_prefix index and the "inv_" check in validate().
    const adminRaw = `inv_adm_${crypto.randomUUID().replaceAll("-", "")}`
    const orgRaw = `inv_org_${crypto.randomUUID().replaceAll("-", "")}`

    const { error: keysErr } = await db.from("api_keys").insert([
        {
            org_id: org.id,
            name: "E2E Admin Key",
            scopes: ["admin", "invoice:read", "invoice:write"],
            key_prefix: adminRaw.slice(0, 8),
            key_hash: await sha256hex(adminRaw),
            status: "active",
        },
        {
            org_id: org.id,
            name: "E2E Org Key",
            scopes: ["invoice:read", "invoice:write"],
            key_prefix: orgRaw.slice(0, 8),
            key_hash: await sha256hex(orgRaw),
            status: "active",
        },
    ])
    if (keysErr) throw new Error(`seed api keys failed: ${keysErr.message}`)

    const createdOrgIds = [org.id as string]

    return {
        orgId: org.id,
        templateId: tpl.id,
        minimalTemplateId: minimalTpl.id,
        bekimTemplateId: bekimTpl.id,
        adminKey: adminRaw,
        orgKey: orgRaw,
        createdOrgIds,
        cleanup: async () => {
            // Org delete cascades api_keys + invoices (+ items, jobs).
            // The global (org_id NULL) template is not cascaded — drop explicitly.
            await db.from("invoice_templates").delete().eq("id", tpl.id)
            for (const id of createdOrgIds) {
                await db.from("organizations").delete().eq("id", id)
            }
        },
    }
}

export interface RunningWorker {
    baseUrl: string
    stop: () => void
}

/** Spawns `wrangler dev` for the API worker and waits until it serves HTTP. */
export async function startApiWorker(config: E2eConfig): Promise<RunningWorker> {
    const proc = Bun.spawn(
        [
            "bunx",
            "wrangler",
            "dev",
            "--config",
            "wrangler.api.toml",
            "--port",
            String(config.port),
            // Pass DB secrets as dev vars (split on first ':' — URLs keep their colons).
            "--var",
            `SUPABASE_URL:${config.supabaseUrl}`,
            "--var",
            `SUPABASE_SERVICE_ROLE_KEY:${config.supabaseServiceRoleKey}`,
            "--var",
            `ADMIN_API_KEY:${config.adminApiKey}`,
            "--log-level",
            "warn",
        ],
        { stdout: "pipe", stderr: "pipe", env: { ...process.env } },
    )

    const deadline = Date.now() + 60_000
    let lastErr = "no response yet"

    while (Date.now() < deadline) {
        if (proc.exitCode !== null) {
            const stderr = await new Response(proc.stderr).text()
            throw new Error(`wrangler dev exited early (code ${proc.exitCode}):\n${stderr}`)
        }
        try {
            await fetch(`${config.baseUrl}/`, { signal: AbortSignal.timeout(2000) })
            return { baseUrl: config.baseUrl, stop: () => proc.kill() }
        } catch (e) {
            lastErr = (e as Error).message
            await Bun.sleep(500)
        }
    }

    proc.kill()
    throw new Error(`wrangler dev not ready within 60s (last error: ${lastErr})`)
}

export interface WorkerR2 {
    puts: Array<{ key: string; size: number }>
}

/**
 * Builds an `Env` for invoking the invoice worker (and an in-process API handler)
 * with a real Supabase connection, an in-memory R2 store (put persists bytes, get
 * returns them — enough for the download route), and a no-op queue stub.
 */
export function makeWorkerEnv(config: E2eConfig): { env: Env; r2: WorkerR2 } {
    const store = new Map<string, Uint8Array>()
    const r2: WorkerR2 = { puts: [] }

    const toBytes = (value: ArrayBuffer | Uint8Array | string): Uint8Array =>
        typeof value === "string"
            ? new TextEncoder().encode(value)
            : value instanceof ArrayBuffer
                ? new Uint8Array(value)
                : value

    const bucket = {
        put: async (key: string, value: ArrayBuffer | Uint8Array | string) => {
            const bytes = toBytes(value)
            store.set(key, bytes)
            r2.puts.push({ key, size: bytes.byteLength })
            return { key } as unknown
        },
        get: async (key: string) => {
            const bytes = store.get(key)
            if (!bytes) return null
            return {
                key,
                size: bytes.byteLength,
                arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
            } as unknown
        },
        head: async () => null,
        delete: async (key: string) => { store.delete(key) },
    }

    const queue = { send: async () => undefined, sendBatch: async () => undefined }

    const env: Env = {
        INVOICES_BUCKET: bucket as unknown as R2Bucket,
        INVOICE_QUEUE: queue as unknown as Queue,
        SUPABASE_URL: config.supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: config.supabaseServiceRoleKey,
        ADMIN_API_KEY: config.adminApiKey,
        LOG_LEVEL: "error",
        NODE_ENV: "test",
    }

    return { env, r2 }
}

/**
 * In-process API web handler over a given Env. Used to exercise the PDF download
 * route against the same in-memory R2 the worker wrote to (the live `wrangler dev`
 * worker has its own separate miniflare R2, so it can't see those bytes).
 */
export function makeApiHandler(env: Env): (request: Request) => Promise<Response> {
    const { handler } = HttpApiBuilder.toWebHandler(
        Layer.mergeAll(makeCoreLayer(env), HttpServer.layerContext),
    )
    return handler
}

/** Minimal MessageBatch stub for the queue() handler. */
export function makeQueueBatch(bodies: QueueMessage[]): {
    batch: MessageBatch<QueueMessage>
    acked: number[]
    retried: number[]
} {
    const acked: number[] = []
    const retried: number[] = []

    const batch = {
        queue: "invoice-processing",
        messages: bodies.map((body, i) => ({
            id: `e2e-msg-${i}`,
            timestamp: new Date(),
            body,
            attempts: 1,
            ack: () => acked.push(i),
            retry: () => retried.push(i),
        })),
        ackAll: () => undefined,
        retryAll: () => undefined,
    }

    return { batch: batch as unknown as MessageBatch<QueueMessage>, acked, retried }
}

/** No-op ExecutionContext stub. */
export function makeCtx(): ExecutionContext {
    return {
        waitUntil: () => undefined,
        passThroughOnException: () => undefined,
    } as unknown as ExecutionContext
}
