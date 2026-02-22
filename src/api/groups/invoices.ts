import { HttpApiEndpoint, HttpApiGroup, HttpApiSecurity } from "@effect/platform"
import { Schema } from "effect"
import { Invoice, CreateInvoice } from "../../shared/schemas/invoice.js"
import { DatabaseError, NotFoundError, UnauthorizedError } from "../../shared/errors/index.js"

export class ApiKeyAuth extends HttpApiSecurity.apiKey({ key: "x-api-key" }) { }

export class InvoicesApi extends HttpApiGroup.make("invoices")
    .add(
        HttpApiEndpoint.post("create", "/api/v1/invoices")
            .setPayload(CreateInvoice)
            .addSuccess(Invoice)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.get("list", "/api/v1/invoices")
            .addSuccess(Schema.Array(Invoice))
            .addError(DatabaseError, { status: 500 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.get("findById", "/api/v1/invoices/:id")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(Schema.Struct({ invoice: Invoice, items: Schema.Array(Schema.Unknown) }))
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.get("getPdfUrl", "/api/v1/invoices/:id/pdf")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(Schema.Struct({ url: Schema.String }))
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .annotateContext(
        HttpApiSecurity.apiKey({ key: "x-api-key" })
    ) { }
