import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { InvoicingApi } from "../api.js"
import { TemplateService } from "../../shared/services/template.js"
import { CurrentOrg } from "../middleware/auth.js"

export const TemplatesApiLive = HttpApiBuilder.group(
    InvoicingApi,
    "templates",
    (handlers) =>
        Effect.gen(function* () {
            const templateService = yield* TemplateService

            return handlers
                .handle("create", ({ payload }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* templateService.create(currentOrg.orgId, payload)
                    })
                )
                .handle("list", () =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* templateService.list(currentOrg.orgId)
                    })
                )
                .handle("findById", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* templateService.findById(id, currentOrg.orgId)
                    })
                )
                .handle("update", ({ path: { id }, payload }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* templateService.update(id, payload, currentOrg.orgId)
                    })
                )
                .handle("archive", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        yield* templateService.delete(id, currentOrg.orgId)
                        return void 0
                    })
                )
        })
)
