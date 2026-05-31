// Generates N admin API keys (DB-agnostic): prints the raw keys once and a SQL
// block that creates an admin org + inserts the keys. Apply to any target DB.
// Run: bun run src/scripts/generate-admin-keys.ts [count]

const N = Number(process.argv[2] ?? 3)

const sha256hex = async (s: string) => {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

const rows: Array<{ name: string; raw: string; prefix: string; hash: string }> = []
for (let i = 0; i < N; i++) {
    const raw = "inv_" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0")).join("")
    rows.push({ name: `admin-${i + 1}`, raw, prefix: raw.slice(0, 8), hash: await sha256hex(raw) })
}

console.log("=== RAW ADMIN KEYS (store now — only the hash is persisted) ===")
for (const r of rows) console.log(`${r.name}: ${r.raw}`)

const q = (s: string) => `'${s}'`
const values = rows.map((r) => `    (${q(r.name)}, ${q(r.prefix)}, ${q(r.hash)})`).join(",\n")

console.log("\n=== SQL — creates an admin org + inserts the keys (run on local or prod) ===")
console.log(`with org as (
  insert into organizations (name, legal_name, country_code, default_currency, invoice_prefix)
  values ('Platform Admin', 'Platform Admin', 'SK', 'EUR', 'ADM')
  returning id
)
insert into api_keys (org_id, name, scopes, key_prefix, key_hash, status)
select org.id, v.name, array['admin','invoice:read','invoice:write'], v.prefix, v.hash, 'active'
from org, (values
${values}
) as v(name, prefix, hash);`)
