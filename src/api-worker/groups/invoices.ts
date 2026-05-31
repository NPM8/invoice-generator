import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { Invoice, CreateInvoice } from "../../shared/schemas/invoice.js"
import { DatabaseError, NotFoundError, UnauthorizedError, StorageError } from "../../shared/errors/index.js"
import { AuthMiddleware } from "../middleware/auth.js"

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
    .add(
        HttpApiEndpoint.get("downloadPdf", "/api/v1/invoices/:id/pdf/download")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(HttpApiSchema.Uint8Array({ contentType: "application/pdf" }))
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(StorageError, { status: 500 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .middleware(AuthMiddleware) { }
