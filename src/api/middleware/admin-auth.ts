import { HttpApiMiddleware } from "@effect/platform"
import { Effect, Layer } from "effect"
import { AuthMiddleware, CurrentOrg } from "./auth.js"
import { UnauthorizedError } from "../../shared/errors/index.js"

export class AdminAuthMiddleware extends HttpApiMiddleware.Tag<AdminAuthMiddleware>()(
    "AdminAuthMiddleware",
    {
        dependencies: [AuthMiddleware],
        failure: UnauthorizedError,
    }
) { }

export const AdminAuthMiddlewareLive = Layer.effect(
    AdminAuthMiddleware,
    Effect.gen(function* () {
        return AdminAuthMiddleware.of({
            dependencies: Effect.gen(function* () {
                const currentOrg = yield* CurrentOrg

                if (!currentOrg.scopes.includes("admin")) {
                    yield* Effect.fail(new UnauthorizedError({ message: "Admin scope required" }))
                }
            })
        })
    })
)
