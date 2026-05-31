// One-shot provision + deploy from .env.deploy.
// Run: bun run deploy:all   (loads .env.deploy via --env-file)
//
// Steps: validate env -> create R2 bucket + queues -> apply migrations
// (supabase db push over a direct connection) -> set wrangler secrets ->
// deploy both workers -> bootstrap an admin org + API key (printed once).
// Idempotent where it can be; safe to re-run.

const REQUIRED = [
    "CLOUDFLARE_ACCOUNT_ID",
    "SUPABASE_PROJECT_REF",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_PASSWORD",
    "ADMIN_API_KEY",
]

const env = process.env
const missing = REQUIRED.filter((k) => !env[k])
if (missing.length) {
    console.error(`Missing env (set them in .env.deploy): ${missing.join(", ")}`)
    process.exit(1)
}

const ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID!
const baseEnv = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT } as Record<string, string>

/** Run a command, streaming output. Optionally feed `input` to stdin. */
async function sh(cmd: string[], opts: { input?: string; allowFail?: boolean } = {}): Promise<number> {
    console.log(`\n$ ${cmd.join(" ")}`)
    const proc = Bun.spawn(cmd, {
        stdin: opts.input != null ? Buffer.from(opts.input) : "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: baseEnv,
    })
    const code = await proc.exited
    if (code !== 0 && !opts.allowFail) {
        console.error(`Command failed (exit ${code}): ${cmd.join(" ")}`)
        process.exit(code)
    }
    return code
}

// 1. Resources (idempotent — ignore "already exists").
console.log("\n=== Cloudflare resources ===")
await sh(["bunx", "wrangler", "r2", "bucket", "create", "invoices"], { allowFail: true })
await sh(["bunx", "wrangler", "queues", "create", "invoice-processing"], { allowFail: true })
await sh(["bunx", "wrangler", "queues", "create", "invoice-processing-dlq"], { allowFail: true })

// 2. Migrations over a direct Postgres connection (no access token / link needed).
console.log("\n=== Database migrations ===")
const dbUrl = `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD!)}@db.${env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`
await sh(["bunx", "supabase", "db", "push", "--db-url", dbUrl])

// 3. Secrets (piped via stdin so values never appear in argv).
console.log("\n=== Secrets ===")
const secret = (name: string, value: string, config: string) =>
    sh(["bunx", "wrangler", "secret", "put", name, "--config", config], { input: value })

for (const config of ["wrangler.api.toml", "wrangler.invoice.toml"]) {
    await secret("SUPABASE_URL", env.SUPABASE_URL!, config)
    await secret("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY!, config)
}
await secret("ADMIN_API_KEY", env.ADMIN_API_KEY!, "wrangler.api.toml")

// 4. Deploy both workers.
console.log("\n=== Deploy ===")
await sh(["bunx", "wrangler", "deploy", "--config", "wrangler.api.toml"])
await sh(["bunx", "wrangler", "deploy", "--config", "wrangler.invoice.toml"])

// 5. Bootstrap an admin org + API key via the Supabase REST API (service role).
console.log("\n=== Bootstrap admin key ===")
const SB = env.SUPABASE_URL!
const KEY = env.SUPABASE_SERVICE_ROLE_KEY!
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "content-type": "application/json", Prefer: "return=representation" }
const orgName = env.BOOTSTRAP_ORG_NAME || "Platform Admin"

const sha256hex = async (s: string) => {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Reuse the bootstrap org if it already exists.
let orgId: string
const found = await fetch(`${SB}/rest/v1/organizations?select=id&name=eq.${encodeURIComponent(orgName)}&limit=1`, { headers: h })
const foundRows = (await found.json()) as Array<{ id: string }>
if (foundRows.length) {
    orgId = foundRows[0]!.id
    console.log(`Reusing org "${orgName}" (${orgId})`)
} else {
    const res = await fetch(`${SB}/rest/v1/organizations`, {
        method: "POST", headers: h,
        body: JSON.stringify({ name: orgName, legal_name: orgName, country_code: "SK", default_currency: "EUR", invoice_prefix: "ADM" }),
    })
    if (!res.ok) { console.error(`Create org failed: ${res.status} ${await res.text()}`); process.exit(1) }
    orgId = ((await res.json()) as Array<{ id: string }>)[0]!.id
    console.log(`Created org "${orgName}" (${orgId})`)
}

const rawKey = `inv_adm_${crypto.randomUUID().replaceAll("-", "")}`
const keyRes = await fetch(`${SB}/rest/v1/api_keys`, {
    method: "POST", headers: h,
    body: JSON.stringify({
        org_id: orgId, name: "bootstrap-admin", scopes: ["admin", "invoice:read", "invoice:write"],
        key_prefix: rawKey.slice(0, 8), key_hash: await sha256hex(rawKey), status: "active",
    }),
})
if (!keyRes.ok) { console.error(`Create admin key failed: ${keyRes.status} ${await keyRes.text()}`); process.exit(1) }

console.log("\n========================================================")
console.log("  Deploy complete.")
console.log("  API:        https://invoicing-api.<account>.workers.dev  (exact URL in wrangler output above)")
console.log(`  ADMIN KEY:  ${rawKey}`)
console.log("  ^ store this now — it is shown only once (only its hash is stored).")
console.log("  Use it as x-api-key to POST /admin/api-keys and mint per-app keys.")
console.log("========================================================")
