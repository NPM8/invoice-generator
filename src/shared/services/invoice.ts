import { Context, Effect, Layer } from "effect"
import { DatabaseService } from "./database.js"
import { QueueService } from "./queue.js"
import { StorageService } from "./storage.js"
import { OrganizationService } from "./organization.js"
import { TemplateService } from "./template.js"
import { DatabaseError, NotFoundError, QueueError, StorageError } from "../errors/index.js"
import { CreateInvoice, Invoice, InvoiceItem } from "../schemas/invoice.js"
import { calculateLineVat, computeVatSummary, computeInvoiceTotals, determineReverseCharge } from "./vat.js"

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
        createdAt: row.created_at,
    })

    const service: Context.Tag.Service<InvoiceService> = {
        create: (orgId, input) =>
            Effect.gen(function* () {
                // 1. Resolve Org details for seller snapshot
                const org = yield* orgService.findById(orgId)

                // 2. Resolve Template
                const template = yield* templateService.resolveForInvoice(orgId, input.templateId ? input.templateId : null)

                // 3. Perform VAT Calculations
                const isReverseCharge = determineReverseCharge(org.countryCode, input.buyerCountryCode, input.buyerTaxId)

                const lineResults = input.items.map(item => {
                    const vatRes = calculateLineVat(
                        item.quantity,
                        item.unitPrice,
                        item.discountPercent,
                        item.vatRate,
                        isReverseCharge ? "reverse_charge" : item.vatType
                    )
                    return {
                        ...item,
                        ...vatRes
                    }
                })

                const vatSummary = computeVatSummary(lineResults.map(i => ({
                    netAmount: i.netAmount,
                    vatAmount: i.vatAmount,
                    grossAmount: i.grossAmount,
                    vatRate: i.vatRate,
                    vatType: isReverseCharge ? "reverse_charge" : i.vatType
                })))

                const totals = computeInvoiceTotals(lineResults)

                // 4. Generate Invoice Number atomically via RPC or let Trigger handle it?
                // We have a stored procedure: generate_invoice_number(uuid)
                const invoiceNumberResult = yield* Effect.tryPromise({
                    try: async () => {
                        const { data, error } = await client.rpc('generate_invoice_number', { p_org_id: orgId })
                        if (error) throw error
                        return data
                    },
                    catch: (cause) => new DatabaseError({ message: "Failed to generate invoice number", cause })
                })

                // Format seller address
                const sellerAddressParts = [org.addressLine1, org.addressLine2, org.city, org.state, org.postalCode].filter(Boolean)
                const sellerAddress = sellerAddressParts.length > 0 ? sellerAddressParts.join(", ") : "Address not provided"

                // 5. Insert Invoice
                const insertInvoice = yield* Effect.tryPromise({
                    try: async () => {
                        const { data, error } = await client.from("invoices").insert({
                            org_id: orgId,
                            template_id: template.id,
                            invoice_number: invoiceNumberResult,
                            seller_name: org.legalName || org.name,
                            seller_address: sellerAddress,
                            seller_tax_id: org.taxId,
                            seller_tax_id_type: org.taxIdType,
                            seller_country_code: org.countryCode,
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
                            callback_url: input.callbackUrl,
                            notes: input.notes,
                            terms: input.terms,
                            metadata: input.metadata,
                        }).select().single()

                        if (error) throw error
                        return data
                    },
                    catch: (cause) => new DatabaseError({ message: "Failed to create invoice", cause })
                })

                // 6. Insert Items
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
                        }))

                        const { error } = await client.from("invoice_items").insert(itemsInsert)
                        if (error) throw error
                    },
                    catch: (cause) => new DatabaseError({ message: "Failed to insert invoice items", cause })
                })

                // 7. Enqueue PDF Generation Job
                // Contain QueueError so the public create error channel stays DatabaseError | NotFoundError
                yield* queueService.enqueuePdfGeneration(insertInvoice.id).pipe(
                    Effect.catchTag("QueueError", (e) => new DatabaseError({ message: e.message, cause: e.cause }))
                )

                // Return mapped invoice
                return mapInvoiceToCamelCase(insertInvoice) as typeof Invoice.Type
            }),

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
