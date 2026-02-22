import { HttpApiEndpoint, HttpApiGroup, HttpApiSecurity } from "@effect/platform"
import { Schema } from "effect"
import { Organization, CreateOrganization, UpdateOrganization } from "../../shared/schemas/organization.js"
import { DatabaseError, NotFoundError, UnauthorizedError } from "../../shared/errors/index.js"
import { ApiKeyAuth } from "./invoices.js"

export class OrganizationsApi extends HttpApiGroup.make("organizations")
    .add(
        HttpApiEndpoint.post("create", "/api/v1/organizations")
            .setPayload(CreateOrganization)
            .addSuccess(Organization)
            .addError(DatabaseError, { status: 500 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.get("list", "/api/v1/organizations")
            .addSuccess(Schema.Array(Organization))
            .addError(DatabaseError, { status: 500 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.get("findById", "/api/v1/organizations/:id")
            .setPath(Schema.Struct({ id: Schema.String }))
            .addSuccess(Organization)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .add(
        HttpApiEndpoint.put("update", "/api/v1/organizations/:id")
            .setPath(Schema.Struct({ id: Schema.String }))
            .setPayload(UpdateOrganization)
            .addSuccess(Organization)
            .addError(DatabaseError, { status: 500 })
            .addError(NotFoundError, { status: 404 })
            .addError(UnauthorizedError, { status: 401 })
    )
    .annotateContext(
        HttpApiSecurity.apiKey({ key: "x-api-key" })
    ) { }
