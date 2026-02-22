import { HttpApiEndpoint, HttpApiGroup, HttpApiSecurity } from "@effect/platform"
import { Schema } from "effect"
import { InvoiceTemplate, CreateTemplate, UpdateTemplate } from "../../shared/schemas/template.js"
import { DatabaseError, NotFoundError, UnauthorizedError } from "../../shared/errors/index.js"
import { ApiKeyAuth } from "./invoices.js"

export class TemplatesApi extends HttpApiGroup.make("templates")
    .add(
        HttpApiEndpoint.post("create", "/api/v1/templates")
            .setPayload(CreateTemplate)
            .addSuccess(InvoiceTemplate)
            .addError(DatabaseError, { status: 500 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.get("list", "/api/v1/templates")
            .addSuccess(Schema.Array(InvoiceTemplate))
            .addError(DatabaseError, { status: 500 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.get("findById", "/api/v1/templates/:id")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(InvoiceTemplate)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.put("update", "/api/v1/templates/:id")
            .setPath(Schema.Struct({ id: Schema.String }))
            .setPayload(UpdateTemplate)
            .addSuccess(InvoiceTemplate)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.del("archive", "/api/v1/templates/:id")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(Schema.Void)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .annotateContext(
        HttpApiSecurity.apiKey({ key: "x-api-key" })
    ) { }
