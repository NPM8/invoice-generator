import { HttpApi } from "@effect/platform"
import { InvoicesApi } from "./groups/invoices.js"
import { TemplatesApi } from "./groups/templates.js"
import { OrganizationsApi } from "./groups/organizations.js"
import { AdminApi } from "./groups/admin.js"

export class InvoicingApi extends HttpApi.make("invoicing-service")
    .add(InvoicesApi)
    .add(TemplatesApi)
    .add(OrganizationsApi)
    .add(AdminApi) { }
