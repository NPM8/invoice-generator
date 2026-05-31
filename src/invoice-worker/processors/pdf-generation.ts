import { Effect } from "effect"
import { InvoiceService } from "../../shared/services/invoice.js"
import { TemplateService } from "../../shared/services/template.js"
import { StorageService } from "../../shared/services/storage.js"
import { QueueService } from "../../shared/services/queue.js"
import { LoggerService } from "../../shared/services/logger.js"
import { PdfService } from "../services/pdf.js"
import { resolveTemplateComponent } from "../../templates/registry.js"
import type { InvoicePropsType } from "../../templates/types.js"

export const handlePdfGeneration = (invoiceId: string) =>
    Effect.gen(function* () {
        const invoiceService = yield* InvoiceService
        const templateService = yield* TemplateService
        const storageService = yield* StorageService
        const queueService = yield* QueueService
        const logger = yield* LoggerService
        const pdfService = yield* PdfService

        yield* invoiceService.updateStatus(invoiceId, "processing")

        const { invoice, items } = yield* invoiceService.findById(invoiceId)

        const template = yield* templateService.findById(invoice.templateId!)

        const props: InvoicePropsType = {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            orgId: invoice.orgId,

            sellerName: invoice.sellerName,
            sellerAddress: invoice.sellerAddress ?? "",
            sellerTaxId: invoice.sellerTaxId,
            sellerTaxIdType: invoice.sellerTaxIdType,
            sellerCountryCode: invoice.sellerCountryCode,

            buyerName: invoice.buyerName,
            buyerAddress: invoice.buyerAddress,
            buyerTaxId: invoice.buyerTaxId,
            buyerTaxIdType: invoice.buyerTaxIdType,
            buyerCountryCode: invoice.buyerCountryCode,
            buyerEmail: invoice.buyerEmail,

            currency: invoice.currency,
            subtotal: invoice.subtotal,
            totalVat: invoice.totalVat,
            total: invoice.total,
            vatSummary: invoice.vatSummary.map((v) => ({ ...v })),
            isReverseCharge: invoice.isReverseCharge,

            items: items.map((item) => ({
                position: item.position,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                discountPercent: item.discountPercent,
                vatRate: item.vatRate,
                vatAmount: item.vatAmount,
                netAmount: item.netAmount,
                grossAmount: item.grossAmount,
            })),

            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,

            notes: invoice.notes,
            terms: invoice.terms,
            metadata: invoice.metadata,

            helpers: {
                formatCurrency: (amount: number, currencyCode: string = invoice.currency) =>
                    new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(amount),
                formatDate: (dateString: string) =>
                    new Date(dateString).toLocaleDateString(),
            }
        }

        // Bundled templates are selected by name (no runtime TSX compilation on
        // Workers); unknown names fall back to the default. See templates/registry.ts.
        const Component = resolveTemplateComponent(template.name)

        const buffer = yield* pdfService.renderToBuffer(Component, props)

        const path = `invoices/${invoice.orgId}/${invoice.id}.pdf`
        yield* storageService.uploadPdf(path, buffer)
        const pdfUrl = yield* storageService.getSignedUrl(path, 31536000)

        yield* invoiceService.updateStatus(invoiceId, "completed", pdfUrl)

        if (invoice.callbackUrl) {
            yield* queueService.enqueueCallbackDelivery(invoice.id)
        }

        yield* logger.info(`PDF generated for invoice ${invoiceId}`)
    })
