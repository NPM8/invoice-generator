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
  "callbackUrl": "https://... (optional)",
  "notes": "optional",
  "terms": "optional",
  "metadata": { }                                  // optional
}
```
Response `200` — `Invoice` (see shape below). Errors: 401, 404 (org/template), 500.

### `GET /api/v1/invoices`
List the org's invoices. → `200` `Invoice[]`. Errors: 401, 500.

### `GET /api/v1/invoices/:id`
→ `200` `{ "invoice": Invoice, "items": InvoiceItem[] }`. Errors: 401, 404, 500.

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
buyerName, buyerAddress, buyerTaxId, buyerTaxIdType, buyerCountryCode, buyerEmail,
currency, subtotal, totalVat, total,
vatSummary: [{ vatRate, vatType, netAmount, vatAmount, grossAmount }],
isReverseCharge, issueDate, dueDate,
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
  "email": "...", "phone": "...", "website": "...",
  "bankName": "...", "bankIban": "...", "bankSwift": "...", "bankAccountNumber": "...",
  "logoUrl": "...",
  "defaultCurrency": "EUR (default)", "defaultPaymentTermsDays": 30, "invoicePrefix": "INV"
}
```
`UpdateOrganization` — all fields optional. Errors: 401, 404 (id routes), 500.

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
> `name` (registry in `src/templates/registry.ts` — e.g. `default-invoice`,
> `minimal`); unknown names fall back to the default. To use one, create a
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
