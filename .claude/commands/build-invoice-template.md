---
description: Build a new bundled invoice PDF template from a company site — scrape design, propose 3 options in a browser preview, implement + test the pick, render a sample PDF.
argument-hint: <company-url>
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch
---

You are building a new **bundled** invoice PDF template for this Cloudflare Workers
service. Target company site: **$ARGUMENTS**

Read these first so you follow the real contracts (do not skip):
- `src/templates/types.ts` — `InvoicePropsType` (the exact data + `helpers` a template receives).
- `src/templates/registry.ts` — how templates are selected by name.
- `src/templates/components/bekim-minimal.tsx` — the canonical reference (font, logo, payment badge).
  `default-invoice.tsx` / `minimal-invoice.tsx` — other examples.
- `API.md` (Templates section) and `AGENTS.md` (Templates section).

Hard rules (react-pdf on Workers):
- A template is a React component: **default export**, takes `InvoicePropsType`, returns a react-pdf `<Document>`.
- Primitives only: `Document, Page, View, Text, Image, StyleSheet, Link`. No HTML.
- **Numeric borders use `*Width`** (`borderWidth`, `borderBottomWidth`) — `border: 1` crashes render.
- **Fonts:** `"Helvetica"` is built-in but ASCII-only. For diacritics (Slovak/Czech/Polish etc.) use the
  embedded Unicode font: `import { UNICODE_FONT, registerUnicodeFont } from "../fonts.js"`, call
  `registerUnicodeFont()` at module top, set `fontFamily: UNICODE_FONT`. Don't `Font.register` other CDN fonts.
- No Node/browser-only globals (no `URL.createObjectURL`, no `fs`).
- Use the provided `helpers.formatCurrency` / `helpers.formatDate` for all money/dates.

Put scratch artifacts under `tmp/` (gitignored). Confirm with the user at the gates noted below.

---

## Step 1 — Study the company design

1. `WebFetch` $ARGUMENTS. Extract a design brief: primary/accent colors (hex), font feel
   (serif/sans, weight), layout vibe, and any tagline/legal name.
2. Try to grab the logo (best-effort; continue without it if it fails):
   - Look in the HTML for `<link rel="icon">`, `og:image`, header `<img>`, or `/favicon.ico`.
   - Download the best candidate with `curl -sL <url> -o tmp/template-assets/logo.<ext>`
     (create the dir first). Prefer SVG/PNG. Note the saved path.
3. Summarize the brief to the user in 3-5 bullet points before proceeding.

## Step 2 — Propose 3 design options (browser preview)

These are **HTML/CSS approximations** of the PDF layout for picking a direction — react-pdf
output differs, but layout/colors/hierarchy should match. Make the three meaningfully distinct
(e.g. classic/columnar, bold-header/branded, minimal/whitespace).

1. Build a self-contained gallery: write `tmp/preview/index.html` showing all 3 mockups side by
   side, each on an A4-proportioned card, labeled **Option 1 / 2 / 3**, using realistic sample
   invoice data and the company colors/logo.
2. Write `tmp/preview/server.ts` and serve it with Bun:
   ```ts
   const PORT = 4321
   Bun.serve({
     port: PORT,
     fetch(req) {
       const url = new URL(req.url)
       const path = url.pathname === "/" ? "/index.html" : url.pathname
       const file = Bun.file(`tmp/preview${path}`)
       return new Response(file)
     },
   })
   console.log(`Preview at http://localhost:${PORT}`)
   ```
   Run it in the background: `bun run tmp/preview/server.ts` (background). Give the user the URL
   `http://localhost:4321` and **ask which option (1/2/3)** they want — or to request tweaks.
   Iterate on the HTML until they pick. **Kill the server** once chosen.

## Step 3 — Implement the chosen template + test

1. Pick a kebab-case key, e.g. `acme-classic`. Create
   `src/templates/components/<key>.tsx` as a real react-pdf component implementing the chosen
   option (translate the HTML mock to react-pdf primitives + `StyleSheet`). Use the logo via
   `<Image src={logoUrl} />` guarded by `logoUrl` (it's an optional prop).
   - **Payment badge (required):** read `paymentStatus`/`paymentMethod`/`paidAt`/`cardLast4`. When
     `paymentStatus === "paid"`, show a paid badge **instead of** bank details — e.g.
     `✓ Paid {by card ••••4242} {· date}` (method label from `paymentMethod`, last-4 from `cardLast4`,
     date via `helpers.formatDate(paidAt)`). When unpaid, show bank-transfer details
     (`bankName`/`bankIban`/`bankSwift`). Mirror `bekim-minimal.tsx`.
2. Register it in `src/templates/registry.ts`: import + add `"<key>": <Component>` to
   `BUNDLED_TEMPLATES`.
3. Add a test mirroring the existing pattern in `tests/e2e/invoice-flow.test.ts`
   ("renders a non-default bundled template selected by templateId"): seed a template row named
   `<key>`, create an invoice with its `templateId`, run the worker, download → assert 200 +
   `%PDF` magic bytes. (e2e needs local Supabase — see `tests/e2e/README.md`.) If Supabase isn't
   available, at minimum add a unit-level render test (see Step 4's render harness).
4. Verify: `bunx tsc --noEmit` is clean and `bun test` passes. Do not claim done otherwise.

## Step 4 — Render a sample PDF for the user

Render the new component directly (no Effect runtime needed) with sample data and save to the
working directory. Write `tmp/render-sample.ts`:
```ts
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import Template from "../../src/templates/components/<key>.js"

const sample = {
  invoiceId: "11111111-1111-1111-1111-111111111111",
  invoiceNumber: "ACME-000123", orgId: "org-1",
  sellerName: "Acme Studio Ltd", sellerAddress: "1 Market St, Berlin", sellerTaxId: "DE123456789",
  sellerTaxIdType: "eu_vat", sellerCountryCode: "DE",
  buyerName: "Globex S.A.", buyerAddress: "10 Rue de Rivoli, Paris", buyerTaxId: "FR987654321",
  buyerTaxIdType: "eu_vat", buyerCountryCode: "FR", buyerEmail: "ap@globex.fr",
  currency: "EUR", subtotal: 1200, totalVat: 228, total: 1428,
  vatSummary: [{ vatRate: 19, vatType: "standard", netAmount: 1200, vatAmount: 228, grossAmount: 1428 }],
  isReverseCharge: false,
  items: [
    { position: 1, description: "Design retainer", quantity: 10, unit: "h", unitPrice: 100, discountPercent: 0, vatRate: 19, vatAmount: 190, netAmount: 1000, grossAmount: 1190 },
    { position: 2, description: "Brand assets", quantity: 1, unit: "pcs", unitPrice: 200, discountPercent: 0, vatRate: 19, vatAmount: 38, netAmount: 200, grossAmount: 238 },
  ],
  issueDate: "2026-01-15", dueDate: "2026-02-15",
  // Payment — flip paymentStatus to "unpaid" to preview the bank-details branch instead of the paid badge.
  paymentStatus: "paid", paymentMethod: "card", paidAt: "2026-01-15T10:30:00Z", cardLast4: "4242",
  logoUrl: null, bankName: "N26", bankIban: "DE89370400440532013000", bankSwift: "NTSBDEB1", bankAccountNumber: null,
  notes: "Thanks for your business.", terms: "Net 30.", metadata: {},
  helpers: {
    formatCurrency: (a: number, c = "EUR") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(a),
    formatDate: (s: string) => new Date(s).toLocaleDateString(),
  },
}

const buf = await renderToBuffer(React.createElement(Template as any, sample as any))
await Bun.write("invoice-sample.pdf", buf)
console.log("Wrote invoice-sample.pdf")
```
Run `bun run tmp/render-sample.ts`. Confirm `invoice-sample.pdf` exists in the working directory
(non-empty, starts with `%PDF`) and give the user the path. If a logo was downloaded, set
`logoUrl` to its path/data-URL to include it.

---

## Wrap up
- Report: design brief, chosen option, files added/changed, test result, and the sample PDF path.
- Clean up the `tmp/` server process. Don't commit `tmp/` or `invoice-sample.pdf` (gitignored).
- Per `AGENTS.md`, re-evaluate that doc if this added/changed anything structural.
