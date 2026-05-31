import { HttpApiMiddleware } from "@effect/platform"
import { Effect, Layer, Redacted } from "effect"
import { ApiKeyService } from "../../shared/services/api-key.js"
import { CurrentOrg, ApiKeySecurity } from "./auth.js"
import { UnauthorizedError } from "../../shared/errors/index.js"

export class AdminAuthMiddleware extends HttpApiMiddleware.Tag<AdminAuthMiddleware>()(
    "AdminAuthMiddleware",
    {
        security: {
            apiKey: ApiKeySecurity,
        },
        provides: CurrentOrg,
        failure: UnauthorizedError,
    }
) { }

export const AdminAuthMiddlewareLive = Layer.effect(
    AdminAuthMiddleware,
    Effect.gen(function* () {
        const apiKeyService = yield* ApiKeyService

        return AdminAuthMiddleware.of({
            apiKey: (key) =>
                apiKeyService.validate(Redacted.value(key)).pipe(
                    Effect.catchTag("DatabaseError", (error) =>
                        Effect.fail(
                            new UnauthorizedError({
                                message: "Failed to validate API key",
                                reason: error.message,
                            })
                        )
                    ),
                    Effect.flatMap(
                        (result): Effect.Effect<CurrentOrg, UnauthorizedError> =>
                            result.scopes.includes("admin")
                                ? Effect.succeed({
                                    orgId: result.orgId,
                                    scopes: result.scopes,
                                })
                                : Effect.fail(
                                    new UnauthorizedError({ message: "Admin scope required" })
                                )
                    )
                ),
        })
    })
)
