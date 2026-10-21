import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { InvoiceService, InvoiceServiceLive } from "../../../src/shared/services/invoice.js"
import { DatabaseService } from "../../../src/shared/services/database.js"
import { QueueService } from "../../../src/shared/services/queue.js"
import { StorageService } from "../../../src/shared/services/storage.js"
import { OrganizationService } from "../../../src/shared/services/organization.js"
import { TemplateService } from "../../../src/shared/services/template.js"

// Mock layers
const MockDatabaseService = Layer.succeed(
    DatabaseService,
    DatabaseService.of({
        client: {} as any,
        getAdminClient: () => ({} as any),
        getOrgClient: () => Effect.succeed({} as any),
    })
)

const MockQueueService = Layer.succeed(
    QueueService,
    QueueService.of({
        enqueuePdfGeneration: () => Effect.void,
        enqueueCallbackDelivery: () => Effect.void,
    })
)

const MockStorageService = Layer.succeed(
    StorageService,
    StorageService.of({
        uploadPdf: () => Effect.void,
        getSignedUrl: () => Effect.succeed("/api/v1/invoices/mock/pdf/download"),
        getPdf: () => Effect.succeed(new Uint8Array()),
    })
)

const MockOrganizationService = Layer.succeed(
    OrganizationService,
    OrganizationService.of({
        create: () => Effect.succeed({} as any),
        findById: () => Effect.succeed({ countryCode: "US", legalName: "Mock Org" } as any),
        update: () => Effect.succeed({} as any),
        list: () => Effect.succeed([]),
    })
)

const MockTemplateService = Layer.succeed(
    TemplateService,
    TemplateService.of({
        resolveForInvoice: () => Effect.succeed({ id: "tpl-1" } as any),
        create: () => Effect.succeed({} as any),
        findById: () => Effect.succeed({} as any),
        update: () => Effect.succeed({} as any),
        list: () => Effect.succeed([]),
        delete: () => Effect.void,
    })
)

describe("InvoiceService Integration", () => {
    it("compiles and constructs the layer graph", async () => {
        const TestLayer = InvoiceServiceLive.pipe(
            Layer.provide(MockDatabaseService),
            Layer.provide(MockQueueService),
            Layer.provide(MockStorageService),
            Layer.provide(MockOrganizationService),
            Layer.provide(MockTemplateService)
        )

        const program = Effect.gen(function* () {
            const service = yield* InvoiceService
            expect(service).toBeDefined()
        })

        await Effect.runPromise(Effect.provide(program, TestLayer))
    })
})

describe("Seller legal snapshots", () => {
    it("copies legal details into the invoice and retains them after the organization changes", async () => {
        const org = { countryCode: "SK", legalName: "Bezbarfit s. r. o.", companyRegistrationNumber: "50969684", localTaxId: "2120546571", registrationDetails: "Mestský súd Bratislava III\nOddiel: Sro, vložka číslo: 120761/B" }
        let inserted: any
        const client = {
            rpc: async () => ({ data: "ADM-000009", error: null }),
            from: (table: string) => ({
                insert: (row: any) => {
                    if (table === "invoice_items") return Promise.resolve({ error: null })
                    inserted = row
                    return { select: () => ({ single: async () => ({ data: { ...row, id: "11111111-1111-4111-8111-111111111111" }, error: null }) }) }
                },
            }),
        }
        const TestLayer = InvoiceServiceLive.pipe(
            Layer.provide(Layer.succeed(DatabaseService, DatabaseService.of({ client: client as any, getAdminClient: () => client as any, getOrgClient: () => Effect.succeed(client as any) }))),
            Layer.provide(MockQueueService), Layer.provide(MockStorageService),
            Layer.provide(Layer.succeed(OrganizationService, OrganizationService.of({ create: () => Effect.succeed(org as any), findById: () => Effect.succeed(org as any), update: () => Effect.succeed(org as any), list: () => Effect.succeed([]) }))),
            Layer.provide(MockTemplateService),
        )
        const { Schema } = await import("effect")
        const { CreateInvoice } = await import("../../../src/shared/schemas/invoice.js")
        const input = Schema.decodeUnknownSync(CreateInvoice)({ buyerName: "Test buyer", buyerAddress: "Test address", buyerCountryCode: "SK", currency: "EUR", issueDate: "2026-10-21", dueDate: "2026-10-21", items: [{ position: 1, description: "Test item", quantity: 1, unitPrice: 10, vatRate: 23 }] })
        const invoice = await Effect.runPromise(Effect.provide(Effect.flatMap(InvoiceService, service => service.create("22222222-2222-4222-8222-222222222222", input)), TestLayer))
        expect(inserted.seller_company_registration_number).toBe("50969684")
        expect(inserted.seller_local_tax_id).toBe("2120546571")
        expect(inserted.seller_registration_details).toContain("120761/B")
        org.companyRegistrationNumber = "changed"
        org.localTaxId = "changed"
        org.registrationDetails = "changed"
        expect(invoice.sellerCompanyRegistrationNumber).toBe("50969684")
        expect(invoice.sellerLocalTaxId).toBe("2120546571")
        expect(invoice.sellerRegistrationDetails).toContain("120761/B")
        expect(invoice.invoiceNumber).toBe("ADM-000009")
    })
})
