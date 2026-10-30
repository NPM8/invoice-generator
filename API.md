# Invoicing Service — API Reference

HTTP API for the `invoicing-api` Cloudflare Worker. For an AI/agent integrating
*against* this service. Machine-readable spec: `openapi.json`
(regenerate with `bun run generate-openapi`). For working *on* the codebase, see
`AGENTS.md`.

Base path: deploy origin (e.g. `https://invoicing-api.<acct>.workers.dev`).
All bodies are JSON. Timestamps are ISO-8601 strings. IDs are UUIDs.

## Authentication

Every route requires an API key header:

```
x-api-key: inv_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- Keys are issued via `POST /admin/api-keys` and belong to one organization.
- The key's org scopes all `/api/v1/*` data (invoices/templates created or read
  are bound to the key's org).
- `/admin/*` routes additionally require the key to have the `"admin"` scope.
- Missing/invalid/expired key, or admin route without admin scope → `401`.

## Errors

JSON error bodies are tagged. Status mapping:

| Status | `_tag`            | Meaning                                   |
|--------|-------------------|-------------------------------------------|
| 401    | `UnauthorizedError` | bad/missing key, or missing admin scope |
| 404    | `NotFoundError`     | entity (or its PDF) not found           |
| 500    | `DatabaseError`     | DB failure                              |
| 500    | `StorageError`      | R2 read failure (PDF download)          |
| 400    | `HttpApiDecodeError`| request payload failed schema validation|

Example:
```json
{ "_tag": "NotFoundError", "message": "Invoice or PDF not found", "id": "..." }
```

---

## Invoices

### `POST /api/v1/invoices`
Create an invoice for the key's org. Seller info is snapshotted from the org;
VAT + totals are computed server-side; status starts `pending` and a PDF-
generation job is enqueued.

Request (`CreateInvoice`):
```json
{
  "templateId": "uuid (optional; default template if omitted)",
  "buyerName": "Acme Buyer",
  "buyerAddress": "10 Buyer Ave, Paris",       // required
  "buyerTaxId": "FR123 (optional)",
  "buyerTaxIdType": "eu_vat|us_ein|gb_vat|au_abn|other (optional)",
  "buyerCountryCode": "FR",                      // ISO-3166 alpha-2
  "buyerEmail": "buyer@acme.fr (optional)",
  "currency": "EUR",                             // ISO-4217
  "items": [                                      // >= 1
    {
      "position": 1,
      "description": "Consulting",
      "quantity": 10,
      "unit": "pcs (optional, default 'pcs')",
      "unitPrice": 100,
      "discountPercent": 0,                       // optional, default 0
      "vatRate": 19,
      "vatType": "standard (optional, default 'standard')"
    }
  ],
  "issueDate": "2026-01-15",                      // YYYY-MM-DD
  "dueDate": "2026-02-15",
  // Payment — record how it was paid (e.g. card at checkout in your app).
  // Shown on the invoice instead of bank-transfer details. No payment is processed here.
  "paymentStatus": "paid",                         // optional: 'paid'|'unpaid' (default 'unpaid')
  "paymentMethod": "card",                         // optional: 'card'|'bank_transfer'|'cash'|'other'
  "paidAt": "2026-01-15T10:30:00Z",                // optional
  "cardLast4": "4242",                             // optional, 4 digits
  "callbackUrl": "https://... (optional)",
  "notes": "optional",
  "terms": "optional",
  "metadata": { }                                  // optional
}
```
Response `200` — `Invoice` (see shape below). Errors: 401, 404 (org/template), 500.

#### Platform mode (optional fields)
For one API key (one org) rendering invoices **on behalf of many sellers** (e.g. a
SaaS invoicing for each of its operators). The caller is the source of truth:
the service renders exactly what it sends. All fields are optional; omitting them
keeps the behaviour above unchanged.

```jsonc
{
  "externalRef": "booking-42",          // 1..200. Idempotency key per org: a repeat returns the
                                         // existing invoice (200, same shape); nothing is created,
                                         // no number consumed. Concurrent repeats are safe.
  "invoiceNumber": "FV/2026/10/0042",   // 1..64, no control chars. Used verbatim (org sequence not
                                         // touched). Per-org number uniqueness applies only to
                                         // invoices WITHOUT externalRef, so sellers may share numbers.
  "seller": {                            // Seller snapshot instead of the key's org
    "name": "Przestrzeń Łódź Sp. z o.o.",   // 1..200
    "address": "ul. Piotrkowska 120\n90-006 Łódź",  // 1..500 (newlines kept)
    "countryCode": "PL",                 // also drives reverse-charge auto-detection
    "taxId": "PL7251234567", "taxIdType": "eu_vat",
    "companyRegistrationNumber": "0000123456",
    "localTaxId": "...", "registrationDetails": "...",
    "email": "faktury@example.pl",
    "bankName": "mBank", "bankIban": "PL61...", "bankSwift": "BREXPLPW", "bankAccountNumber": "..."
  },                                     // With seller set, bank details + logo on the PDF come ONLY
                                         // from the invoice (never the org's).
  "branding": {
    "logoUrl": "https://... | data:image/png;base64,... | data:image/jpeg;base64,...", // <= 2,000,000 chars
    "accentColor": "#0f766e",
    "displayName": "Przestrzeń Coworking" // shown instead of a logo when none is given
  },
  "locale": "en|pl|de|cs|sk",           // PDF labels (brand template) + number/date/currency format.
                                         // Absent => sk-SK formatting (as before).
  "templateName": "brand",              // bundled template by name: default-invoice|minimal|bekim-minimal|brand.
                                         // No invoice_templates row needed (templateId is then null and ignored).
  "paymentUrl": "https://pay.example.com/i/abc",  // "Pay online" link while unpaid
  "legalNotes": ["Zwolnienie z VAT: art. 43 ust. 1 pkt 37 ustawy o VAT"],  // <= 10, each 1..1000
  "items": [{
    "position": 1, "description": "Desk", "quantity": 1, "unitPrice": 100,
    "vatRate": 23, "vatType": "standard",
    "vatLabel": "23%",                   // optional 1..100, shown instead of the numeric rate ("zw", "np")
    "amounts": { "net": 100, "vat": 23, "gross": 123 }  // optional: used verbatim, no calculation
  }]
}
```

Amounts: when any line carries `amounts`, those lines are stored as given, totals
are the sums, and the VAT summary groups by `vatRate + vatType + vatLabel`. The
caller then also owns reverse charge: `isReverseCharge` is true iff a line has
`vatType: "reverse_charge"` (no auto-detection, so a cross-border invoice with
local VAT is not mislabelled). Lines without `amounts` are calculated as before.

The `brand` template renders: logo (or display name), accent colour, seller/buyer,
dates, items (qty, unit, unit price, VAT label/rate, net, gross), VAT summary,
totals, paid badge or bank details + pay-online link, notes/terms, legal notes and
page numbers — in the invoice `locale` (default Slovak labels).

### `GET /api/v1/invoices`
List the org's invoices. → `200` `Invoice[]`. Errors: 401, 500.

### `GET /api/v1/invoices/:id`
→ `200` `{ "invoice": Invoice, "items": InvoiceItem[] }` (items carry `vatLabel`, null when not sent). Errors: 401, 404, 500.

### `GET /api/v1/invoices/:id/pdf`
PDF URL metadata. → `200` `{ "url": "/api/v1/invoices/:id/pdf/download" }`.
`404` until the worker has generated the PDF. Errors: 401, 404, 500.

### `GET /api/v1/invoices/:id/pdf/download`
The PDF bytes. → `200`, `Content-Type: application/pdf` (binary body).
Errors: 401, 404 (no PDF yet / not your org), 500 (`StorageError`).

**`Invoice` shape** (response):
```
id, orgId, invoiceNumber, templateId, status ('pending'|'processing'|'completed'|'failed'),
sellerName, sellerAddress, sellerTaxId, sellerTaxIdType, sellerCountryCode,
sellerCompanyRegistrationNumber, sellerLocalTaxId, sellerRegistrationDetails,
buyerName, buyerAddress, buyerTaxId, buyerTaxIdType, buyerCountryCode, buyerEmail,
currency, subtotal, totalVat, total,
vatSummary: [{ vatRate, vatType, netAmount, vatAmount, grossAmount, vatLabel? }],
isReverseCharge, issueDate, dueDate,
paymentStatus ('paid'|'unpaid'), paymentMethod, paidAt, cardLast4,
// platform mode (null/false when not used):
externalRef, templateName, locale, sellerOverride (bool), sellerEmail,
sellerBankName, sellerBankIban, sellerBankSwift, sellerBankAccountNumber,
logoUrl, accentColor, brandDisplayName, paymentUrl, legalNotes (string[]),
pdfUrl, pdfGeneratedAt,
callbackUrl, callbackStatus, callbackAttempts, callbackLastAttemptAt,
notes, terms, metadata, createdAt, updatedAt
```

---

## Organizations

| Method & path | Body | Success |
|---|---|---|
| `POST /api/v1/organizations` | `CreateOrganization` | `200` `Organization` |
| `GET /api/v1/organizations` | — | `200` `Organization[]` |
| `GET /api/v1/organizations/:id` | — | `200` `Organization` |
| `PUT /api/v1/organizations/:id` | `UpdateOrganization` | `200` `Organization` |

`CreateOrganization` (required: `name`, `legalName`, `countryCode`):
```json
{
  "name": "Buyer Co", "legalName": "Buyer Co Ltd", "countryCode": "FR",
  "addressLine1": "...", "addressLine2": "...", "city": "...", "state": "...",
  "postalCode": "...", "taxId": "...", "taxIdType": "eu_vat|...",
  "companyRegistrationNumber": "50969684", "localTaxId": "2120546571",
  "registrationDetails": "Registry court, section and entry (optional text)",
  "email": "...", "phone": "...", "website": "...",
  "bankName": "...", "bankIban": "...", "bankSwift": "...", "bankAccountNumber": "...",
  "logoUrl": "...",
  "defaultCurrency": "EUR (default)", "defaultPaymentTermsDays": 30, "invoicePrefix": "INV"
}
```
`UpdateOrganization` — all fields optional. The three legal-detail fields accept null to clear them. New invoices snapshot them; organization edits never rewrite existing invoices or change the numbering sequence. Errors: 401, 404 (id routes), 500.

---

## Templates

Templates are org-scoped, plus global defaults (`orgId: null`). The bundled
default renders without custom code.

| Method & path | Body | Success |
|---|---|---|
| `POST /api/v1/templates` | `CreateTemplate` | `200` `InvoiceTemplate` |
| `GET /api/v1/templates` | — | `200` `InvoiceTemplate[]` |
| `GET /api/v1/templates/:id` | — | `200` `InvoiceTemplate` |
| `PUT /api/v1/templates/:id` | `UpdateTemplate` | `200` `InvoiceTemplate` |
| `DELETE /api/v1/templates/:id` | — | `200` (archives) |

`CreateTemplate` (required: `name`, `componentCode`):
```json
{ "name": "Modern", "description": "optional",
  "componentCode": "<TSX source>", "propsSchema": { } }
```
> Rendering: the worker selects a **bundled** React component by the template's
> `name` (registry in `src/templates/registry.ts` — `default-invoice`,
> `minimal`, `bekim-minimal`, `brand`); unknown names fall back to the default.
> Alternatively pass `templateName` on invoice creation — no template row needed. To use one, create a
> template row whose `name` matches a registry key, then pass its `templateId`
> when creating an invoice. Arbitrary `componentCode` compilation at runtime is
> **not** supported on Workers (esbuild can't run there) — add new designs to the
> registry instead. See `AGENTS.md`. Errors: 401, 404, 500.

---

## Admin — API keys (require `admin` scope)

| Method & path | Body | Success |
|---|---|---|
| `POST /admin/api-keys` | `CreateApiKey` | `200` `ApiKeyWithSecret` (raw `key` shown once) |
| `GET /admin/api-keys` | — | `200` `ApiKeyResponse[]` (no secret) |
| `DELETE /admin/api-keys/:id` | — | `200` (hard delete) |
| `POST /admin/api-keys/:id/revoke` | — | `200` |
| `POST /admin/api-keys/:id/regenerate` | — | `200` `ApiKeyWithSecret` |

`CreateApiKey` (required: `orgId`, `name`):
```json
{ "orgId": "uuid", "name": "CI key",
  "scopes": ["invoice:read","invoice:write"],   // optional, default []; use ["admin"] for admin keys
  "expiresAt": "2027-01-01T00:00:00Z" }           // optional
```
`ApiKeyWithSecret` = key metadata + `"key": "inv_..."` (store it; not retrievable later).
Errors: 401, 404 (id routes), 500.

> Bootstrap: the first admin key must be inserted directly into the `api_keys`
> table (key_hash = SHA-256 of the raw `inv_...` key, `scopes` containing
> `"admin"`) — there is no unauthenticated key-creation route. See
> `tests/e2e/helpers/setup.ts` for the exact procedure.

---

## Lifecycle summary

```
POST /admin/api-keys (admin key)        -> issue org key
POST /api/v1/invoices (org key)         -> invoice 'pending', PDF job enqueued
   [invoice-worker renders PDF -> R2, status 'completed', pdfUrl set]
GET  /api/v1/invoices/:id/pdf           -> { url }   (404 until generated)
GET  /api/v1/invoices/:id/pdf/download  -> application/pdf bytes
```
