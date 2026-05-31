import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { InvoicingApi } from "../api.js"
import { OrganizationService } from "../../shared/services/organization.js"
import { CurrentOrg } from "../middleware/auth.js"

export const OrganizationsApiLive = HttpApiBuilder.group(
    InvoicingApi,
    "organizations",
    (handlers) =>
        Effect.gen(function* () {
            const orgService = yield* OrganizationService

            return handlers
                .handle("create", ({ payload }) =>
                    Effect.gen(function* () {
                        return yield* orgService.create(payload)
                    })
                )
                .handle("list", () =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* orgService.list(currentOrg.orgId)
                    })
                )
                .handle("findById", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* orgService.findById(id, currentOrg.orgId)
                    })
                )
                .handle("update", ({ path: { id }, payload }) =>
                    Effect.gen(function* () {
                        const currentOrg = yield* CurrentOrg
                        return yield* orgService.update(id, payload, currentOrg.orgId)
                    })
                )
        })
)
