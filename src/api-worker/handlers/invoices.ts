import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { InvoicingApi } from "../api.js"
import { InvoiceService } from "../../shared/services/invoice.js"
import { CurrentOrg } from "../middleware/auth.js"

export const InvoicesApiLive = HttpApiBuilder.group(
    InvoicingApi,
    "invoices",
    (handlers) =>
        Effect.gen(function* () {
            const invoiceService = yield* InvoiceService

            return handlers
                .handle("create", ({ payload }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* invoiceService.create(currentOrg.orgId, payload)
                    })
                )
                .handle("list", () =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* invoiceService.list(currentOrg.orgId)
                    })
                )
                .handle("findById", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* invoiceService.findById(id, currentOrg.orgId)
                    })
                )
                .handle("getPdfUrl", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        const url = yield* invoiceService.getPdfUrl(id, currentOrg.orgId)
                        return { url }
                    })
                )
                .handle("downloadPdf", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* invoiceService.getPdfContent(id, currentOrg.orgId)
                    })
                )
        })
)
