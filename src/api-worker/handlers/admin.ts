import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { InvoicingApi } from "../api.js"
import { ApiKeyService } from "../../shared/services/api-key.js"
import { AdminAuthMiddleware } from "../middleware/admin-auth.js"

export const AdminApiLive = HttpApiBuilder.group(
    InvoicingApi,
    "admin",
    (handlers) =>
        Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService

            yield* AdminAuthMiddleware

            return handlers
                .handle("generateKey", ({ payload }) =>
                    Effect.gen(function* () {
                        return yield* apiKeyService.generate(payload)
                    })
                )
                .handle("listKeys", () =>
                    Effect.gen(function* () {
                        return yield* apiKeyService.list()
                    })
                )
                .handle("removeKey", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        yield* apiKeyService.remove(id)
                        return void 0
                    })
                )
                .handle("revokeKey", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        yield* apiKeyService.revoke(id)
                        return void 0
                    })
                )
                .handle("regenerateKey", ({ path: { id } }) =>
                    Effect.gen(function* () {
                        return yield* apiKeyService.regenerate(id)
                    })
                )
        })
)
