import { Context, Effect, Layer } from "effect"
import { Worker, Job } from "bullmq"
import Redis from "ioredis"
import { ConfigService } from "../../shared/config/index.js"
import { LoggerService } from "../../shared/services/logger.js"
import { InvoiceService } from "../../shared/services/invoice.js"
import { TemplateService } from "../../shared/services/template.js"
import { StorageService } from "../../shared/services/storage.js"
import { QueueService } from "../../shared/services/queue.js"
import { PdfService } from "../services/pdf.js"
import { TemplateCompilerService } from "../services/template-compiler.js"

// We import the pre-built default template directly
import DefaultInvoice from "../../templates/components/default-invoice.js"

export const PdfWorkerLive = Layer.scopedDiscard(
    Effect.gen(function* () {
        const config = yield* ConfigService
        const logger = yield* LoggerService
        const invoiceService = yield* InvoiceService
        const templateService = yield* TemplateService
        const storageService = yield* StorageService
        const queueService = yield* QueueService
        const pdfService = yield* PdfService
        const compilerService = yield* TemplateCompilerService

        const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null })

        const worker = new Worker(
            "pdf-generation",
            async (job: Job) => {
                const { invoiceId } = job.data

                const runEffect = Effect.gen(function* () {
                    yield* invoiceService.updateStatus(invoiceId, "processing")

                    // Fetch invoice & items
                    // Use service role since worker shouldn't need orgId context (pass undefined to bypass orgId check)
                    const { invoice, items } = yield* invoiceService.findById(invoiceId)
                    if (!invoice) throw new Error("Invoice not found")

                    // Resolve template
                    const template = yield* templateService.findById(invoice.templateId!)

                    // Construct props
                    const props = {
                        ...invoice,
                        items,
                        helpers: {
                            formatCurrency: (amount: number, currencyCode: string = invoice.currency) => {
                                return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(amount)
                            },
                            formatDate: (dateString: string) => {
                                return new Date(dateString).toLocaleDateString()
                            }
                        }
                    }

                    let Component = DefaultInvoice as any

                    if (!template.isDefault) {
                        Component = yield* compilerService.compile(
                            template.id,
                            template.version,
                            template.componentCode
                        )
                    }

                    // Generate PDF
                    const buffer = yield* pdfService.renderToBuffer(Component, props)

                    // Upload PDF
                    const path = `invoices/${invoice.orgId}/${invoice.id}.pdf`
                    yield* storageService.uploadPdf(path, buffer)
                    const publicUrl = yield* storageService.getSignedUrl(path, 31536000) // 1 year URL for demo purposes

                    // Complete
                    yield* invoiceService.updateStatus(invoiceId, "completed", publicUrl)

                    // Enqueue callback if exists
                    if (invoice.callbackUrl) {
                        yield* queueService.enqueueCallbackDelivery(`callback-${invoice.id}`, invoice.id)
                    }
                }).pipe(
                    Effect.catchAll((cause) => {
                        // Re-throw so BullMQ handles exact retry logic
                        return Effect.sync(() => { throw cause })
                    })
                )

                // run the Effect
                try {
                    // Providing actual services? No, we extracted the methods inside gen, 
                    // we can just run the pre-resolved Effect natively
                    await Effect.runPromise(runEffect)
                    logger.info(`PDF generated for invoice ${invoiceId}`)
                } catch (e: any) {
                    logger.error(`PDF generation failed for invoice ${invoiceId}: ${e?.message}`, e)
                    throw e
                }
            },
            { connection, concurrency: 5 }
        )

        yield* Effect.addFinalizer(() =>
            Effect.tryPromise(() => worker.close())
        )
    })
)
