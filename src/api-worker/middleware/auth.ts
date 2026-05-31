import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { Context, Effect, Layer, Redacted } from "effect"
import { ApiKeyService } from "../../shared/services/api-key.js"
import { UnauthorizedError } from "../../shared/errors/index.js"

export interface CurrentOrg {
    readonly orgId: string
    readonly scopes: string[]
}

export const CurrentOrg = Context.GenericTag<CurrentOrg>("CurrentOrg")

export const ApiKeySecurity = HttpApiSecurity.apiKey({
    in: "header",
    key: "x-api-key",
})

export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()(
    "AuthMiddleware",
    {
        security: {
            apiKey: ApiKeySecurity,
        },
        provides: CurrentOrg,
        failure: UnauthorizedError,
    }
) { }

export const AuthMiddlewareLive = Layer.effect(
    AuthMiddleware,
    Effect.gen(function* () {
        const apiKeyService = yield* ApiKeyService

        return AuthMiddleware.of({
            apiKey: (key) =>
                apiKeyService.validate(Redacted.value(key)).pipe(
                    Effect.map(
                        (result): CurrentOrg => ({
                            orgId: result.orgId,
                            scopes: result.scopes,
                        })
                    ),
                    Effect.catchTag("DatabaseError", (error) =>
                        Effect.fail(
                            new UnauthorizedError({
                                message: "Failed to validate API key",
                                reason: error.message,
                            })
                        )
                    )
                ),
        })
    })
)
