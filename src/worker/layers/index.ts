import { Layer } from "effect"

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
import { CallbackServiceLive } from "../../shared/services/callback.js"

// Worker specific logic
import { PdfServiceLive } from "../services/pdf.js"
import { TemplateCompilerServiceLive } from "../services/template-compiler.js"
import { PdfWorkerLive } from "../processors/pdf-generation.js"
import { CallbackWorkerLive } from "../processors/callback-delivery.js"

export const ServicesLive = Layer.mergeAll(
    OrganizationServiceLive,
    TemplateServiceLive,
    InvoiceServiceLive,
    CallbackServiceLive,
    PdfServiceLive,
    TemplateCompilerServiceLive
).pipe(
    Layer.provide(Layer.mergeAll(DatabaseServiceLive, StorageServiceLive, QueueServiceLive)),
    Layer.provide(ConfigServiceLive),
    Layer.provide(LoggerServiceLive)
)

export const WorkersLive = Layer.mergeAll(
    PdfWorkerLive,
    CallbackWorkerLive
).pipe(
    Layer.provide(ServicesLive)
)
