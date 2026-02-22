import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { Context, Effect, Layer } from "effect"
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
    description: "API Key matching inv_... for authentication"
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
                Effect.gen(function* () {
                    const result = yield* apiKeyService.validate(key)

                    return Context.make(CurrentOrg, {
                        orgId: result.orgId,
                        scopes: result.scopes,
                    })
                }),
        })
    })
)
