import { HttpApiEndpoint, HttpApiGroup, HttpApiSecurity } from "@effect/platform"
import { Schema } from "effect"
import { ApiKeyResponse, ApiKeyWithSecret, CreateApiKey } from "../../shared/schemas/api-key.js"
import { DatabaseError, NotFoundError, UnauthorizedError } from "../../shared/errors/index.js"
import { ApiKeyAuth } from "./invoices.js"

export class AdminApi extends HttpApiGroup.make("admin")
    .add(
        HttpApiEndpoint.post("generateKey", "/admin/api-keys")
            .setPayload(CreateApiKey)
            .addSuccess(ApiKeyWithSecret)
            .addError(DatabaseError, { status: 500 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.get("listKeys", "/admin/api-keys")
            .addSuccess(Schema.Array(ApiKeyResponse))
            .addError(DatabaseError, { status: 500 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.del("removeKey", "/admin/api-keys/:id")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(Schema.Void)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.post("revokeKey", "/admin/api-keys/:id/revoke")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(Schema.Void)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.post("regenerateKey", "/admin/api-keys/:id/regenerate")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(ApiKeyWithSecret)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .annotateContext(
        HttpApiSecurity.apiKey({ key: "x-api-key" })
    ) { }
