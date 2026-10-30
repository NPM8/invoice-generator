import { Effect } from "effect"
import { InvoiceService } from "../../shared/services/invoice.js"
import { OrganizationService } from "../../shared/services/organization.js"
import { TemplateService } from "../../shared/services/template.js"
import { StorageService } from "../../shared/services/storage.js"
import { QueueService } from "../../shared/services/queue.js"
import { LoggerService } from "../../shared/services/logger.js"
import { PdfService } from "../services/pdf.js"
import { resolveTemplateComponent } from "../../templates/registry.js"
import { makeFormatters } from "../../templates/i18n.js"
import type { InvoicePropsType } from "../../templates/types.js"
import type { Invoice, InvoiceItem } from "../../shared/schemas/invoice.js"
import type { Organization } from "../../shared/schemas/organization.js"

type OrgBranding = Pick<typeof Organization.Type, "logoUrl" | "bankName" | "bankIban" | "bankSwift" | "bankAccountNumber">

/**
 * Template props from the stored invoice. Invoices whose seller came from the
 * request (platform mode) never read logo/bank details from the org: those belong
 * to the platform, not to the seller. Otherwise the org stays the live source and
 * a per-invoice branding logo wins over the org logo.
 */
export const buildInvoiceProps = (
    invoice: typeof Invoice.Type,
    items: ReadonlyArray<typeof InvoiceItem.Type>,
    org: OrgBranding,
): InvoicePropsType => {
    const fromInvoice = invoice.sellerOverride === true
    return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orgId: invoice.orgId,

        sellerName: invoice.sellerName,
        sellerAddress: invoice.sellerAddress ?? "",
        sellerTaxId: invoice.sellerTaxId,
        sellerCompanyRegistrationNumber: invoice.sellerCompanyRegistrationNumber,
        sellerLocalTaxId: invoice.sellerLocalTaxId,
        sellerRegistrationDetails: invoice.sellerRegistrationDetails,
        sellerTaxIdType: invoice.sellerTaxIdType,
        sellerCountryCode: invoice.sellerCountryCode,
        sellerEmail: invoice.sellerEmail ?? null,

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
        vatSummary: invoice.vatSummary.map((v) => ({ ...v, vatLabel: v.vatLabel ?? null })),
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
            vatLabel: item.vatLabel ?? null,
        })),

        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,

        paymentStatus: invoice.paymentStatus,
        paymentMethod: invoice.paymentMethod,
        paidAt: invoice.paidAt,
        cardLast4: invoice.cardLast4,

        logoUrl: invoice.logoUrl ?? (fromInvoice ? null : org.logoUrl),
        bankName: fromInvoice ? invoice.sellerBankName ?? null : org.bankName,
        bankIban: fromInvoice ? invoice.sellerBankIban ?? null : org.bankIban,
        bankSwift: fromInvoice ? invoice.sellerBankSwift ?? null : org.bankSwift,
        bankAccountNumber: fromInvoice ? invoice.sellerBankAccountNumber ?? null : org.bankAccountNumber,

        locale: invoice.locale ?? null,
        accentColor: invoice.accentColor ?? null,
        brandDisplayName: invoice.brandDisplayName ?? null,
        paymentUrl: invoice.paymentUrl ?? null,
        legalNotes: invoice.legalNotes ?? null,

        notes: invoice.notes,
        terms: invoice.terms,
        metadata: invoice.metadata,

        helpers: makeFormatters(invoice.locale, invoice.currency),
    }
}

export const handlePdfGeneration = (invoiceId: string) =>
    Effect.gen(function* () {
        const invoiceService = yield* InvoiceService
        const orgService = yield* OrganizationService
        const templateService = yield* TemplateService
        const storageService = yield* StorageService
        const queueService = yield* QueueService
        const logger = yield* LoggerService
        const pdfService = yield* PdfService

        yield* invoiceService.updateStatus(invoiceId, "processing")

        const { invoice, items } = yield* invoiceService.findById(invoiceId)

        // Org branding (logo, bank details) for the template.
        const org = yield* orgService.findById(invoice.orgId)

        // Bundled template by name (platform mode) or via the invoice_templates row.
        const templateName = invoice.templateName
            ?? (yield* templateService.findById(invoice.templateId!)).name

        const props = buildInvoiceProps(invoice, items, org)

        // Bundled templates are selected by name (no runtime TSX compilation on
        // Workers); unknown names fall back to the default. See templates/registry.ts.
        const Component = resolveTemplateComponent(templateName)

        const buffer = yield* pdfService.renderToBuffer(Component, props)

        const path = `invoices/${invoice.orgId}/${invoice.id}.pdf`
        yield* storageService.uploadPdf(path, buffer)
        const pdfUrl = yield* storageService.getSignedUrl(path, 31536000)

        yield* invoiceService.updateStatus(invoiceId, "completed", pdfUrl)

        if (invoice.callbackUrl) {
            yield* queueService.enqueueCallbackDelivery(invoice.id)
        }

        yield* logger.info(`PDF generated for invoice ${invoiceId}`)
    }).pipe(
        Effect.tapError((e) =>
            Effect.gen(function* () {
                const invoiceService = yield* InvoiceService
                const cause = (e as { cause?: unknown }).cause
                const detail = `${(e as Error).message ?? e} :: ${(cause as Error)?.message ?? cause ?? ""}`.slice(0, 800)
                yield* invoiceService.markFailed(invoiceId, detail)
            }).pipe(Effect.ignore),
        ),
    )
