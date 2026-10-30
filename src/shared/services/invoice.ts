import { Context, Effect, Layer } from "effect"
import { DatabaseService } from "./database.js"
import { QueueService } from "./queue.js"
import { StorageService } from "./storage.js"
import { OrganizationService } from "./organization.js"
import { TemplateService } from "./template.js"
import { DatabaseError, NotFoundError, QueueError, StorageError } from "../errors/index.js"
import { CreateInvoice, Invoice, InvoiceItem } from "../schemas/invoice.js"
import { calculateLineVat, computeVatSummary, computeInvoiceTotals, determineReverseCharge, groupByRate, groupByRateTypeLabel } from "./vat.js"
import type { Organization } from "../schemas/organization.js"

type CreateInput = typeof CreateInvoice.Type

/** Drops undefined values so callers not using platform fields never touch the new columns. */
const compact = (row: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined))

/** Seller snapshot columns from the API key's organization (default behaviour). */
const sellerColumnsFromOrg = (org: typeof Organization.Type) => {
    const addressParts = [org.addressLine1, org.addressLine2, org.city, org.state, org.postalCode].filter(Boolean)
    return {
        seller_name: org.legalName || org.name,
        seller_address: addressParts.length > 0 ? addressParts.join(", ") : "Address not provided",
        seller_tax_id: org.taxId,
        seller_company_registration_number: org.companyRegistrationNumber ?? null,
        seller_local_tax_id: org.localTaxId ?? null,
        seller_registration_details: org.registrationDetails ?? null,
        seller_tax_id_type: org.taxIdType,
        seller_country_code: org.countryCode as string,
    }
}

/** Seller snapshot columns from the request (platform mode); bank details live on the invoice. */
const sellerColumnsFromRequest = (seller: NonNullable<CreateInput["seller"]>) => ({
    seller_name: seller.name,
    seller_address: seller.address,
    seller_tax_id: seller.taxId ?? null,
    seller_company_registration_number: seller.companyRegistrationNumber ?? null,
    seller_local_tax_id: seller.localTaxId ?? null,
    seller_registration_details: seller.registrationDetails ?? null,
    seller_tax_id_type: seller.taxIdType ?? null,
    seller_country_code: seller.countryCode as string,
    seller_override: true,
    seller_email: seller.email,
    seller_bank_name: seller.bankName,
    seller_bank_iban: seller.bankIban,
    seller_bank_swift: seller.bankSwift,
    seller_bank_account_number: seller.bankAccountNumber,
})

/**
 * Line amounts + VAT summary + totals. Lines with caller-supplied `amounts` are used
 * verbatim; once any line carries amounts the caller also owns VAT types (reverse
 * charge is then explicit via vatType instead of auto-detected).
 */
export const computeInvoiceAmounts = (
    input: Pick<CreateInput, "items" | "buyerCountryCode" | "buyerTaxId">,
    sellerCountryCode: string,
) => {
    const callerAmounts = input.items.some((item) => item.amounts !== undefined)
    const isReverseCharge = callerAmounts
        ? input.items.some((item) => item.vatType === "reverse_charge")
        : determineReverseCharge(sellerCountryCode, input.buyerCountryCode, input.buyerTaxId)
    const lineVatType = (item: CreateInput["items"][number]) =>
        !callerAmounts && isReverseCharge ? "reverse_charge" as const : item.vatType

    const lines = input.items.map((item) => ({
        ...item,
        vatType: lineVatType(item),
        ...(item.amounts
            ? { netAmount: item.amounts.net, vatAmount: item.amounts.vat, grossAmount: item.amounts.gross }
            : calculateLineVat(item.quantity, item.unitPrice, item.discountPercent, item.vatRate, lineVatType(item))),
    }))

    const callerVat = callerAmounts || input.items.some((item) => item.vatLabel !== undefined)
    const vatSummary = computeVatSummary(
        lines.map((line) => ({
            netAmount: line.netAmount,
            vatAmount: line.vatAmount,
            grossAmount: line.grossAmount,
            vatRate: line.vatRate,
            vatType: line.vatType,
            vatLabel: line.vatLabel,
        })),
        callerVat ? groupByRateTypeLabel : groupByRate,
    )

    return { lines, vatSummary, isReverseCharge, totals: computeInvoiceTotals(lines) }
}

export class InvoiceService extends Context.Tag("InvoiceService")<
    InvoiceService,
    {
        readonly create: (orgId: string, input: typeof CreateInvoice.Type) => Effect.Effect<typeof Invoice.Type, DatabaseError | NotFoundError>
        readonly findById: (id: string, orgIdContext?: string) => Effect.Effect<{ invoice: typeof Invoice.Type, items: Array<typeof InvoiceItem.Type> }, DatabaseError | NotFoundError>
        readonly list: (orgIdContext?: string) => Effect.Effect<Array<typeof Invoice.Type>, DatabaseError>
        readonly updateStatus: (id: string, status: string, pdfUrl?: string) => Effect.Effect<void, DatabaseError>
        readonly markFailed: (id: string, message: string) => Effect.Effect<void, DatabaseError>
        readonly getPdfUrl: (id: string, orgIdContext?: string) => Effect.Effect<string, DatabaseError | NotFoundError>
        readonly getPdfContent: (id: string, orgIdContext?: string) => Effect.Effect<Uint8Array, DatabaseError | NotFoundError | StorageError>
    }
>() { }

const createInvoiceService = Effect.gen(function* () {
    const dbService = yield* DatabaseService
    const queueService = yield* QueueService
    const storageService = yield* StorageService
    const orgService = yield* OrganizationService
    const templateService = yield* TemplateService

    const client = dbService.getAdminClient()

    const mapInvoiceToCamelCase = (row: any) => ({
        id: row.id,
        orgId: row.org_id,
        invoiceNumber: row.invoice_number,
        templateId: row.template_id,
        status: row.status,
        sellerName: row.seller_name,
        sellerAddress: row.seller_address,
        sellerTaxId: row.seller_tax_id,
        sellerCompanyRegistrationNumber: row.seller_company_registration_number ?? null,
        sellerLocalTaxId: row.seller_local_tax_id ?? null,
        sellerRegistrationDetails: row.seller_registration_details ?? null,
        sellerTaxIdType: row.seller_tax_id_type,
        sellerCountryCode: row.seller_country_code,
        buyerName: row.buyer_name,
        buyerAddress: row.buyer_address,
        buyerTaxId: row.buyer_tax_id,
        buyerTaxIdType: row.buyer_tax_id_type,
        buyerCountryCode: row.buyer_country_code,
        buyerEmail: row.buyer_email,
        currency: row.currency,
        subtotal: row.subtotal,
        totalVat: row.total_vat,
        total: row.total,
        vatSummary: row.vat_summary,
        isReverseCharge: row.is_reverse_charge,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        pdfUrl: row.pdf_url,
        pdfGeneratedAt: row.pdf_generated_at,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        paidAt: row.paid_at,
        cardLast4: row.card_last4,
        externalRef: row.external_ref ?? null,
        templateName: row.template_name ?? null,
        locale: row.locale ?? null,
        sellerOverride: row.seller_override ?? false,
        sellerEmail: row.seller_email ?? null,
        sellerBankName: row.seller_bank_name ?? null,
        sellerBankIban: row.seller_bank_iban ?? null,
        sellerBankSwift: row.seller_bank_swift ?? null,
        sellerBankAccountNumber: row.seller_bank_account_number ?? null,
        logoUrl: row.logo_url ?? null,
        accentColor: row.accent_color ?? null,
        brandDisplayName: row.brand_display_name ?? null,
        paymentUrl: row.payment_url ?? null,
        legalNotes: row.legal_notes ?? null,
        callbackUrl: row.callback_url,
        callbackStatus: row.callback_status,
        callbackAttempts: row.callback_attempts,
        callbackLastAttemptAt: row.callback_last_attempt_at,
        notes: row.notes,
        terms: row.terms,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })

    const mapItemToCamelCase = (row: any) => ({
        id: row.id,
        invoiceId: row.invoice_id,
        position: row.position,
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
        unitPrice: row.unit_price,
        discountPercent: row.discount_percent,
        vatRate: row.vat_rate,
        vatAmount: row.vat_amount,
        netAmount: row.net_amount,
        grossAmount: row.gross_amount,
        vatLabel: row.vat_label ?? null,
        createdAt: row.created_at,
    })

    const findByExternalRef = (orgId: string, externalRef: string) =>
        Effect.tryPromise({
            try: async () => {
                const { data, error } = await client.from("invoices").select()
                    .eq("org_id", orgId).eq("external_ref", externalRef).maybeSingle()
                if (error) throw error
                return data ? mapInvoiceToCamelCase(data) as typeof Invoice.Type : null
            },
            catch: (cause) => new DatabaseError({ message: "Failed to look up invoice by externalRef", cause }),
        })

    const generateInvoiceNumber = (orgId: string) =>
        Effect.tryPromise({
            try: async () => {
                const { data, error } = await client.rpc('generate_invoice_number', { p_org_id: orgId })
                if (error) throw error
                return data as string
            },
            catch: (cause) => new DatabaseError({ message: "Failed to generate invoice number", cause })
        })

    const UNIQUE_VIOLATION = "23505"

    const createNew = (orgId: string, input: CreateInput) =>
        Effect.gen(function* () {
            // 1. Resolve Org (numbering owner; default seller snapshot source)
            const org = yield* orgService.findById(orgId)

            // 2. Resolve Template — bundled templates selected by name need no DB row
            const template = input.templateName
                ? null
                : yield* templateService.resolveForInvoice(orgId, input.templateId ? input.templateId : null)

            // 3. Seller snapshot + VAT (reverse-charge detection uses the actual seller's country)
            const seller = input.seller ? sellerColumnsFromRequest(input.seller) : sellerColumnsFromOrg(org)
            const { lines: lineResults, vatSummary, isReverseCharge, totals } =
                computeInvoiceAmounts(input, seller.seller_country_code)

            // 4. Caller-supplied number is used verbatim; otherwise the org sequence (atomic RPC)
            const invoiceNumber = input.invoiceNumber ?? (yield* generateInvoiceNumber(orgId))

            // 5. Insert Invoice (null => lost an externalRef race to a concurrent request)
            const insertInvoice = yield* Effect.tryPromise({
                try: async () => {
                    const { data, error } = await client.from("invoices").insert(compact({
                        org_id: orgId,
                        template_id: template?.id ?? null,
                        invoice_number: invoiceNumber,
                        ...seller,
                        buyer_name: input.buyerName,
                        buyer_address: input.buyerAddress,
                        buyer_tax_id: input.buyerTaxId,
                        buyer_tax_id_type: input.buyerTaxIdType,
                        buyer_country_code: input.buyerCountryCode,
                        buyer_email: input.buyerEmail,
                        currency: input.currency,
                        subtotal: totals.subtotal,
                        total_vat: totals.totalVat,
                        total: totals.total,
                        vat_summary: vatSummary,
                        is_reverse_charge: isReverseCharge,
                        status: "pending",
                        issue_date: input.issueDate,
                        due_date: input.dueDate,
                        payment_status: input.paymentStatus,
                        payment_method: input.paymentMethod,
                        paid_at: input.paidAt,
                        card_last4: input.cardLast4,
                        callback_url: input.callbackUrl,
                        notes: input.notes,
                        terms: input.terms,
                        metadata: input.metadata,
                        external_ref: input.externalRef,
                        template_name: input.templateName,
                        locale: input.locale,
                        logo_url: input.branding?.logoUrl,
                        accent_color: input.branding?.accentColor,
                        brand_display_name: input.branding?.displayName,
                        payment_url: input.paymentUrl,
                        legal_notes: input.legalNotes,
                    })).select().single()

                    if (error?.code === UNIQUE_VIOLATION && input.externalRef) return null
                    if (error) throw error
                    return data
                },
                catch: (cause) => new DatabaseError({ message: "Failed to create invoice", cause })
            })

            if (!insertInvoice) {
                const existing = yield* findByExternalRef(orgId, input.externalRef!)
                return existing
                    ?? (yield* Effect.fail(new DatabaseError({ message: "externalRef conflict but no existing invoice found", cause: input.externalRef })))
            }

            // 6. Insert Items. On failure remove the invoice again, so a retry with the
            //    same externalRef cannot return an invoice without lines.
            yield* Effect.tryPromise({
                try: async () => {
                    const itemsInsert = lineResults.map(item => ({
                        invoice_id: insertInvoice.id,
                        position: item.position,
                        description: item.description,
                        quantity: item.quantity,
                        unit: item.unit,
                        unit_price: item.unitPrice,
                        discount_percent: item.discountPercent,
                        vat_rate: item.vatRate,
                        vat_amount: item.vatAmount,
                        net_amount: item.netAmount,
                        gross_amount: item.grossAmount,
                        ...(item.vatLabel ? { vat_label: item.vatLabel } : {}),
                    }))

                    const { error } = await client.from("invoice_items").insert(itemsInsert)
                    if (error) throw error
                },
                catch: (cause) => new DatabaseError({ message: "Failed to insert invoice items", cause })
            }).pipe(
                Effect.tapError(() =>
                    Effect.promise(async () => { await client.from("invoices").delete().eq("id", insertInvoice.id) })
                        .pipe(Effect.ignore)
                )
            )

            // 7. Enqueue PDF Generation Job
            // Contain QueueError so the public create error channel stays DatabaseError | NotFoundError
            yield* queueService.enqueuePdfGeneration(insertInvoice.id).pipe(
                Effect.catchTag("QueueError", (e) => new DatabaseError({ message: e.message, cause: e.cause }))
            )

            // Return mapped invoice
            return mapInvoiceToCamelCase(insertInvoice) as typeof Invoice.Type
        })

    const service: Context.Tag.Service<InvoiceService> = {
        // Idempotent on (org, externalRef): an existing invoice is returned as-is,
        // nothing is created and no number is consumed.
        create: (orgId, input) =>
            input.externalRef
                ? findByExternalRef(orgId, input.externalRef).pipe(
                    Effect.flatMap((existing) => existing ? Effect.succeed(existing) : createNew(orgId, input))
                )
                : createNew(orgId, input),
        findById: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("invoices").select().eq("id", id)
                    if (orgIdContext) {
                        query = query.eq("org_id", orgIdContext)
                    }

                    const { data, error } = await query.single()

                    if (error) {
                        if (error.code === "PGRST116") return null
                        throw error
                    }
                    return data
                },
                catch: (cause) => new DatabaseError({ message: "Database query failed", cause }),
            }).pipe(
                Effect.flatMap((data) =>
                    data
                        ? Effect.succeed(data)
                        : Effect.fail(new NotFoundError({ message: "Invoice not found", id }))
                ),
                Effect.flatMap((invoiceData) =>
                    Effect.tryPromise({
                        try: async () => {
                            const { data, error } = await client.from("invoice_items").select().eq("invoice_id", id).order("position")
                            if (error) throw error
                            return {
                                invoice: mapInvoiceToCamelCase(invoiceData) as typeof Invoice.Type,
                                items: data.map(mapItemToCamelCase) as Array<typeof InvoiceItem.Type>
                            }
                        },
                        catch: (cause) => new DatabaseError({ message: "Failed to fetch invoice items", cause })
                    })
                )
            ),

        list: (orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("invoices").select()
                    if (orgIdContext) query = query.eq("org_id", orgIdContext)

                    const { data, error } = await query

                    if (error) throw error
                    return data.map(mapInvoiceToCamelCase) as Array<typeof Invoice.Type>
                },
                catch: (cause) => new DatabaseError({ message: "Failed to list invoices", cause }),
            }),

        updateStatus: (id, status, pdfUrl) =>
            Effect.tryPromise({
                try: async () => {
                    const updateData: any = { status }
                    if (pdfUrl) {
                        updateData.pdf_url = pdfUrl
                        updateData.pdf_generated_at = new Date().toISOString()
                    }

                    const { error } = await client.from("invoices").update(updateData).eq("id", id)
                    if (error) throw error
                },
                catch: (cause) => new DatabaseError({ message: "Failed to update invoice status", cause }),
            }),

        getPdfUrl: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("invoices").select("pdf_url").eq("id", id)
                    if (orgIdContext) query = query.eq("org_id", orgIdContext)

                    const { data, error } = await query.single()

                    if (error) {
                        if (error.code === "PGRST116") return null
                        throw error
                    }
                    return data.pdf_url
                },
                catch: (cause) => new DatabaseError({ message: "Failed to fetch PDF URL", cause }),
            }).pipe(
                Effect.flatMap((url) =>
                    url
                        ? Effect.succeed(url)
                        : Effect.fail(new NotFoundError({ message: "Invoice or PDF not found", id }))
                )
            ),

        markFailed: (id, message) =>
            Effect.tryPromise({
                try: async () => {
                    await client.from("invoices").update({ status: "failed", metadata: { error: message } }).eq("id", id)
                },
                catch: (cause) => new DatabaseError({ message: "Failed to mark invoice failed", cause }),
            }),

        getPdfContent: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("invoices").select("org_id, pdf_url").eq("id", id)
                    if (orgIdContext) query = query.eq("org_id", orgIdContext)

                    const { data, error } = await query.single()

                    if (error) {
                        if (error.code === "PGRST116") return null
                        throw error
                    }
                    return data
                },
                catch: (cause) => new DatabaseError({ message: "Failed to fetch invoice for PDF", cause }),
            }).pipe(
                Effect.flatMap((row) =>
                    row && row.pdf_url
                        ? storageService.getPdf(`invoices/${row.org_id}/${id}.pdf`)
                        : Effect.fail(new NotFoundError({ message: "Invoice or PDF not found", id }))
                )
            )
    }

    return service
})

export const InvoiceServiceLive = Layer.effect(InvoiceService, createInvoiceService)
