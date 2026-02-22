import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { InvoicingApi } from "../api.js"
import { InvoicesApiLive } from "../handlers/invoices.js"
import { TemplatesApiLive } from "../handlers/templates.js"
import { OrganizationsApiLive } from "../handlers/organizations.js"
import { AdminApiLive } from "../handlers/admin.js"

// Base shared infra
import { ConfigServiceLive } from "../../shared/config/index.js"
import { LoggerServiceLive } from "../../shared/services/logger.js"
import { DatabaseServiceLive } from "../../shared/services/database.js"
import { StorageServiceLive } from "../../shared/services/storage.js"
import { QueueServiceLive } from "../../shared/services/queue.js"

// Business logic
import { OrganizationServiceLive } from "../../shared/services/organization.js"
import { TemplateServiceLive } from "../../shared/services/template.js"
import { InvoiceServiceLive } from "../../shared/services/invoice.js"
import { ApiKeyServiceLive } from "../../shared/services/api-key.js"
import { CallbackServiceLive } from "../../shared/services/callback.js"

// Middlewares
import { AuthMiddlewareLive } from "../middleware/auth.js"
import { AdminAuthMiddlewareLive } from "../middleware/admin-auth.js"

export const ApiLive = HttpApiBuilder.api(InvoicingApi).pipe(
    Layer.provide(InvoicesApiLive),
    Layer.provide(TemplatesApiLive),
    Layer.provide(OrganizationsApiLive),
    Layer.provide(AdminApiLive)
)

export const MiddlewaresLive = Layer.mergeAll(
    AuthMiddlewareLive,
    AdminAuthMiddlewareLive
)

export const ServicesLive = Layer.mergeAll(
    OrganizationServiceLive,
    TemplateServiceLive,
    InvoiceServiceLive,
    ApiKeyServiceLive,
    CallbackServiceLive
).pipe(
    Layer.provide(Layer.mergeAll(DatabaseServiceLive, StorageServiceLive, QueueServiceLive)),
    Layer.provide(ConfigServiceLive),
    Layer.provide(LoggerServiceLive)
)

export const CoreLayer = ApiLive.pipe(
    Layer.provide(MiddlewaresLive),
    Layer.provide(ServicesLive)
)
