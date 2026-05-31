import { Layer } from "effect"

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
import { CallbackServiceLive } from "../../shared/services/callback.js"

// Worker specific
import { PdfServiceLive } from "../services/pdf.js"

import type { Env } from "../../shared/types/env.js"

export const makeWorkerLayer = (env: Env) => {
    // Infra services. The processors (handlePdfGeneration / handleCallbackDelivery)
    // yield StorageService, QueueService and LoggerService DIRECTLY, so infra must
    // be part of the final layer's output — not merely provided inward. We build it
    // once (with Config) and `provideMerge` it so it is both supplied to the business
    // services AND re-exported for the processors.
    const infra = Layer.mergeAll(
        DatabaseServiceLive,
        makeStorageService(env.INVOICES_BUCKET),
        makeQueueService(env.INVOICE_QUEUE),
        LoggerServiceLive,
    ).pipe(Layer.provide(makeConfigServiceFromEnv(env)))

    // InvoiceService depends on OrganizationService and TemplateService, so they
    // must be provided to it (in addition to being exposed for processors).
    const businessServices = Layer.mergeAll(
        OrganizationServiceLive,
        TemplateServiceLive,
        InvoiceServiceLive,
        CallbackServiceLive,
        PdfServiceLive,
    ).pipe(
        Layer.provideMerge(Layer.mergeAll(OrganizationServiceLive, TemplateServiceLive))
    )

    return businessServices.pipe(Layer.provideMerge(infra))
}
