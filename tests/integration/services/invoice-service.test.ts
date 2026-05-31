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
