import { describe, it, expect } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { InvoiceService, InvoiceServiceLive } from "../../../src/shared/services/invoice.js"
import { DatabaseService } from "../../../src/shared/services/database.js"
import { QueueService } from "../../../src/shared/services/queue.js"
import { StorageService } from "../../../src/shared/services/storage.js"
import { OrganizationService } from "../../../src/shared/services/organization.js"
import { TemplateService } from "../../../src/shared/services/template.js"
import { CreateInvoice } from "../../../src/shared/schemas/invoice.js"

// Platform mode: one API key (org) creating invoices on behalf of many sellers.
// The Supabase client is faked per test; every call is recorded so the tests can
// assert exactly what was (not) written.

const ORG_ID = "22222222-2222-4222-8222-222222222222"
const NEW_ID = "11111111-1111-4111-8111-111111111111"
const EXISTING_ID = "33333333-3333-4333-8333-333333333333"

const platformOrg = {
    name: "cwork", legalName: "cwork platform Ltd", countryCode: "SK",
    addressLine1: "Platform street 1", taxId: "SK0000000000", taxIdType: "eu_vat",
    logoUrl: "https://cdn.cwork.example/logo.png", bankIban: "SK00 PLATFORM",
}

const existingRow = {
    id: EXISTING_ID, org_id: ORG_ID, invoice_number: "INV-0001", external_ref: "booking-42",
    template_id: null, template_name: "brand", status: "completed",
    seller_name: "Operator A", seller_address: "A street", seller_country_code: "PL",
    buyer_name: "Buyer", buyer_country_code: "PL", currency: "PLN",
    subtotal: 100, total_vat: 23, total: 123, vat_summary: [], is_reverse_charge: false,
    issue_date: "2026-10-30", due_date: "2026-11-13", payment_status: "unpaid",
    callback_status: "none", callback_attempts: 0, created_at: "2026-10-30T00:00:00Z", updated_at: "2026-10-30T00:00:00Z",
}

const makeFakeClient = (opts: { existing?: any; insertError?: any; existingAfterConflict?: any }) => {
    const calls = { rpc: 0, invoiceInserts: [] as any[], itemInserts: [] as any[], lookups: 0, deletes: 0 }
    let lookupResults = [opts.existing ?? null, opts.existingAfterConflict ?? null]
    const client = {
        rpc: async () => { calls.rpc++; return { data: "ORG-000007", error: null } },
        from: (table: string) => ({
            select: () => {
                const chain: any = {
                    eq: () => chain,
                    maybeSingle: async () => { const data = lookupResults[calls.lookups] ?? null; calls.lookups++; return { data, error: null } },
                }
                return chain
            },
            insert: (row: any) => {
                if (table === "invoice_items") { calls.itemInserts.push(row); return Promise.resolve({ error: null }) }
                calls.invoiceInserts.push(row)
                return {
                    select: () => ({
                        single: async () => opts.insertError
                            ? { data: null, error: opts.insertError }
                            : { data: { ...row, id: NEW_ID, created_at: "2026-10-30T00:00:00Z", updated_at: "2026-10-30T00:00:00Z" }, error: null },
                    }),
                }
            },
            delete: () => ({ eq: async () => { calls.deletes++; return { error: null } } }),
        }),
    }
    return { client, calls }
}

const run = async (client: any, payload: unknown, track: { enqueued: string[]; templateResolves: number }) => {
    const TestLayer = InvoiceServiceLive.pipe(
        Layer.provide(Layer.succeed(DatabaseService, DatabaseService.of({ client, getAdminClient: () => client, getOrgClient: () => Effect.succeed(client) }))),
        Layer.provide(Layer.succeed(QueueService, QueueService.of({
            enqueuePdfGeneration: (id: string) => Effect.sync(() => { track.enqueued.push(id) }),
            enqueueCallbackDelivery: () => Effect.void,
        }))),
        Layer.provide(Layer.succeed(StorageService, StorageService.of({
            uploadPdf: () => Effect.void,
            getSignedUrl: () => Effect.succeed("/x"),
            getPdf: () => Effect.succeed(new Uint8Array()),
        }))),
        Layer.provide(Layer.succeed(OrganizationService, OrganizationService.of({
            create: () => Effect.succeed(platformOrg as any),
            findById: () => Effect.succeed(platformOrg as any),
            update: () => Effect.succeed(platformOrg as any),
            list: () => Effect.succeed([]),
        }))),
        Layer.provide(Layer.succeed(TemplateService, TemplateService.of({
            resolveForInvoice: () => Effect.sync(() => { track.templateResolves++; return { id: "tpl-1", name: "bekim-minimal" } as any }),
            create: () => Effect.succeed({} as any),
            findById: () => Effect.succeed({} as any),
            update: () => Effect.succeed({} as any),
            list: () => Effect.succeed([]),
            delete: () => Effect.void,
        }))),
    )
    const input = Schema.decodeUnknownSync(CreateInvoice)(payload)
    return Effect.runPromise(Effect.provide(Effect.flatMap(InvoiceService, (s) => s.create(ORG_ID, input)), TestLayer))
}

const basePayload = {
    buyerName: "Kowalski Sp. z o.o.", buyerAddress: "ul. Długa 1, Gdańsk", buyerCountryCode: "PL",
    currency: "PLN", issueDate: "2026-10-30", dueDate: "2026-11-13",
    items: [{ position: 1, description: "Hot desk", quantity: 1, unitPrice: 100, vatRate: 23 }],
}

describe("Platform mode: idempotent externalRef", () => {
    it("returns the existing invoice for a known externalRef without inserting, numbering or enqueuing", async () => {
        const { client, calls } = makeFakeClient({ existing: existingRow })
        const track = { enqueued: [] as string[], templateResolves: 0 }
        const invoice = await run(client, { ...basePayload, externalRef: "booking-42" }, track)
        expect(invoice.id as string).toBe(EXISTING_ID)
        expect(invoice.invoiceNumber).toBe("INV-0001")
        expect(invoice.externalRef).toBe("booking-42")
        expect(calls.invoiceInserts.length).toBe(0)
        expect(calls.itemInserts.length).toBe(0)
        expect(calls.rpc).toBe(0)
        expect(track.enqueued).toEqual([])
    })

    it("creates the invoice and stores external_ref when the externalRef is new", async () => {
        const { client, calls } = makeFakeClient({ existing: null })
        const track = { enqueued: [] as string[], templateResolves: 0 }
        const invoice = await run(client, { ...basePayload, externalRef: "booking-43" }, track)
        expect(invoice.id as string).toBe(NEW_ID)
        expect(calls.invoiceInserts[0].external_ref).toBe("booking-43")
        expect(track.enqueued).toEqual([NEW_ID])
    })

    it("returns the concurrently created invoice when the insert hits the externalRef unique index", async () => {
        const { client, calls } = makeFakeClient({ existing: null, insertError: { code: "23505", message: "duplicate key" }, existingAfterConflict: existingRow })
        const track = { enqueued: [] as string[], templateResolves: 0 }
        const invoice = await run(client, { ...basePayload, externalRef: "booking-42", invoiceNumber: "INV-0001" }, track)
        expect(invoice.id as string).toBe(EXISTING_ID)
        expect(calls.lookups).toBe(2)
        expect(calls.itemInserts.length).toBe(0)
        expect(track.enqueued).toEqual([])
    })

    it("still fails on a unique violation when no externalRef was sent", async () => {
        const { client } = makeFakeClient({ insertError: { code: "23505", message: "duplicate key" } })
        const track = { enqueued: [] as string[], templateResolves: 0 }
        await expect(run(client, basePayload, track)).rejects.toBeDefined()
    })
})

describe("Platform mode: invoiceNumber override", () => {
    it("uses the caller's invoiceNumber verbatim and skips generate_invoice_number", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        const invoice = await run(client, { ...basePayload, invoiceNumber: "FV/2026/10/0042" }, track)
        expect(invoice.invoiceNumber).toBe("FV/2026/10/0042")
        expect(calls.invoiceInserts[0].invoice_number).toBe("FV/2026/10/0042")
        expect(calls.rpc).toBe(0)
    })

    it("generates the org number when invoiceNumber is absent (existing behaviour)", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        const invoice = await run(client, basePayload, track)
        expect(invoice.invoiceNumber).toBe("ORG-000007")
        expect(calls.rpc).toBe(1)
    })
})

describe("Platform mode: seller override", () => {
    it("snapshots the seller and its bank details from the request instead of the org", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        const invoice = await run(client, {
            ...basePayload,
            seller: {
                name: "Przestrzeń Łódź Sp. z o.o.", address: "ul. Piotrkowska 120, 90-006 Łódź", countryCode: "PL",
                taxId: "PL7251234567", taxIdType: "eu_vat", companyRegistrationNumber: "0000123456",
                email: "faktury@przestrzen.pl", bankName: "mBank", bankIban: "PL61109010140000071219812874", bankSwift: "BREXPLPW",
            },
        }, track)
        const row = calls.invoiceInserts[0]
        expect(row.seller_name).toBe("Przestrzeń Łódź Sp. z o.o.")
        expect(row.seller_address).toBe("ul. Piotrkowska 120, 90-006 Łódź")
        expect(row.seller_country_code).toBe("PL")
        expect(row.seller_tax_id).toBe("PL7251234567")
        expect(row.seller_company_registration_number).toBe("0000123456")
        expect(row.seller_override).toBe(true)
        expect(row.seller_email).toBe("faktury@przestrzen.pl")
        expect(row.seller_bank_iban).toBe("PL61109010140000071219812874")
        expect(row.seller_bank_swift).toBe("BREXPLPW")
        expect(invoice.sellerName).toBe("Przestrzeń Łódź Sp. z o.o.")
        expect(invoice.sellerOverride).toBe(true)
        expect(invoice.sellerBankName).toBe("mBank")
    })

    it("uses the seller's country (not the org's) for reverse-charge detection", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        // Org is SK, seller and buyer are PL: domestic => no reverse charge, VAT charged.
        await run(client, {
            ...basePayload, buyerTaxId: "PL1234567890",
            seller: { name: "Operator PL", address: "Warszawa", countryCode: "PL" },
        }, track)
        expect(calls.invoiceInserts[0].is_reverse_charge).toBe(false)
        expect(calls.invoiceInserts[0].total_vat).toBe(23)
    })

    it("keeps the org snapshot when no seller is sent (existing behaviour)", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        // Org is SK, buyer is PL with a VAT id => cross-border reverse charge as before.
        await run(client, { ...basePayload, buyerTaxId: "PL1234567890" }, track)
        const row = calls.invoiceInserts[0]
        expect(row.seller_name).toBe("cwork platform Ltd")
        expect(row.seller_country_code).toBe("SK")
        expect(row.is_reverse_charge).toBe(true)
        expect(row.seller_override).toBeUndefined()
    })
})

describe("Platform mode: precomputed amounts", () => {
    it("stores caller amounts verbatim and sums them into totals", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        const invoice = await run(client, {
            ...basePayload,
            items: [
                { position: 1, description: "Desk", quantity: 3, unitPrice: 33.33, vatRate: 23, amounts: { net: 100, vat: 23, gross: 123 } },
                { position: 2, description: "Mail", quantity: 1, unitPrice: 50, vatRate: 0, vatType: "exempt", vatLabel: "zw", amounts: { net: 50, vat: 0, gross: 50 } },
            ],
        }, track)
        expect(invoice.subtotal).toBe(150)
        expect(invoice.totalVat).toBe(23)
        expect(invoice.total).toBe(173)
        expect(calls.itemInserts[0][0].net_amount).toBe(100)
        expect(calls.itemInserts[0][0].vat_amount).toBe(23)
        expect(calls.itemInserts[0][0].gross_amount).toBe(123)
        expect(calls.itemInserts[0][1].vat_label).toBe("zw")
    })
})

describe("Platform mode: templateName and presentation fields", () => {
    it("does not require an invoice_templates row when templateName is given", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        const invoice = await run(client, { ...basePayload, templateName: "brand" }, track)
        expect(track.templateResolves).toBe(0)
        expect(calls.invoiceInserts[0].template_id).toBeNull()
        expect(calls.invoiceInserts[0].template_name).toBe("brand")
        expect(invoice.templateName).toBe("brand")
    })

    it("persists locale, branding, payment link and legal notes", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        await run(client, {
            ...basePayload,
            locale: "pl",
            branding: { logoUrl: "data:image/png;base64,iVBORw0KGgo=", accentColor: "#0f766e", displayName: "Przestrzeń" },
            paymentUrl: "https://pay.example.com/i/abc",
            legalNotes: ["Zwolnienie z VAT: art. 43 ust. 1 pkt 37"],
        }, track)
        const row = calls.invoiceInserts[0]
        expect(row.locale).toBe("pl")
        expect(row.logo_url).toBe("data:image/png;base64,iVBORw0KGgo=")
        expect(row.accent_color).toBe("#0f766e")
        expect(row.brand_display_name).toBe("Przestrzeń")
        expect(row.payment_url).toBe("https://pay.example.com/i/abc")
        expect(row.legal_notes).toEqual(["Zwolnienie z VAT: art. 43 ust. 1 pkt 37"])
    })

    it("writes none of the new columns for a legacy request", async () => {
        const { client, calls } = makeFakeClient({})
        const track = { enqueued: [] as string[], templateResolves: 0 }
        await run(client, basePayload, track)
        const row = calls.invoiceInserts[0]
        for (const column of ["external_ref", "template_name", "locale", "seller_override", "seller_email", "seller_bank_iban", "logo_url", "accent_color", "brand_display_name", "payment_url", "legal_notes"]) {
            expect(column in row).toBe(false)
        }
        expect(row.template_id).toBe("tpl-1")
        expect("vat_label" in calls.itemInserts[0][0]).toBe(false)
        expect(track.templateResolves).toBe(1)
    })
})
