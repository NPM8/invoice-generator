import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { InvoicingApi } from "../api.js"
import { InvoicesApiLive } from "../handlers/invoices.js"
import { TemplatesApiLive } from "../handlers/templates.js"
import { OrganizationsApiLive } from "../handlers/organizations.js"
import { AdminApiLive } from "../handlers/admin.js"

// Shared infra
import { makeConfigServiceFromEnv } from "../../shared/config/index.js"
import { LoggerServiceLive } from "../../shared/services/logger.js"
import { DatabaseServiceLive } from "../../shared/services/database.js"
import { makeStorageService } from "../../shared/services/storage.js"
import { makeQueueService } from "../../shared/services/queue.js"

// Business logic
import { OrganizationServiceLive } from "../../shared/services/organization.js"
import { TemplateServiceLive } from "../../shared/services/template.js"
import { InvoiceServiceLive } from "../../shared/services/invoice.js"
import { ApiKeyServiceLive } from "../../shared/services/api-key.js"
import { CallbackServiceLive } from "../../shared/services/callback.js"

// Middlewares
import { AuthMiddlewareLive } from "../middleware/auth.js"
import { AdminAuthMiddlewareLive } from "../middleware/admin-auth.js"

import type { Env } from "../../shared/types/env.js"

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

export const makeServicesLive = (env: Env) =>
    Layer.mergeAll(
        OrganizationServiceLive,
        TemplateServiceLive,
        InvoiceServiceLive,
        ApiKeyServiceLive,
        CallbackServiceLive
    ).pipe(
        Layer.provideMerge(Layer.mergeAll(
            OrganizationServiceLive,
            TemplateServiceLive,
        )),
        Layer.provide(Layer.mergeAll(
            DatabaseServiceLive,
            makeStorageService(env.INVOICES_BUCKET),
            makeQueueService(env.INVOICE_QUEUE),
        )),
        Layer.provide(makeConfigServiceFromEnv(env)),
        Layer.provide(LoggerServiceLive)
    )

export const makeCoreLayer = (env: Env) =>
    ApiLive.pipe(
        Layer.provide(MiddlewaresLive),
        Layer.provide(makeServicesLive(env))
    )
