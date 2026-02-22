import { Context, Effect, Layer } from "effect"
import { DatabaseService } from "./database.js"
import { DatabaseError, NotFoundError } from "../errors/index.js"
import { Organization, CreateOrganization, UpdateOrganization } from "../schemas/organization.js"

export class OrganizationService extends Context.Tag("OrganizationService")<
    OrganizationService,
    {
        readonly create: (input: typeof CreateOrganization.Type) => Effect.Effect<typeof Organization.Type, DatabaseError>
        readonly findById: (id: string, orgIdContext?: string) => Effect.Effect<typeof Organization.Type, DatabaseError | NotFoundError>
        readonly update: (id: string, input: typeof UpdateOrganization.Type, orgIdContext?: string) => Effect.Effect<typeof Organization.Type, DatabaseError | NotFoundError>
        readonly list: (orgIdContext?: string) => Effect.Effect<Array<typeof Organization.Type>, DatabaseError>
    }
>() { }

const createOrganizationService = Effect.gen(function* () {
    const dbService = yield* DatabaseService
    const client = dbService.getAdminClient()

    const mapToCamelCase = (row: any) => ({
        id: row.id,
        name: row.name,
        legalName: row.legal_name,
        addressLine1: row.address_line1,
        addressLine2: row.address_line2,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
        countryCode: row.country_code,
        taxId: row.tax_id,
        taxIdType: row.tax_id_type,
        email: row.email,
        phone: row.phone,
        website: row.website,
        bankName: row.bank_name,
        bankIban: row.bank_iban,
        bankSwift: row.bank_swift,
        bankAccountNumber: row.bank_account_number,
        logoUrl: row.logo_url,
        defaultCurrency: row.default_currency,
        defaultPaymentTermsDays: row.default_payment_terms_days,
        invoicePrefix: row.invoice_prefix,
        nextInvoiceNumber: row.next_invoice_number,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })

    const mapToSnakeCase = (obj: any) => {
        const result: any = {}
        if (obj.name !== undefined) result.name = obj.name
        if (obj.legalName !== undefined) result.legal_name = obj.legalName
        if (obj.addressLine1 !== undefined) result.address_line1 = obj.addressLine1
        if (obj.addressLine2 !== undefined) result.address_line2 = obj.addressLine2
        if (obj.city !== undefined) result.city = obj.city
        if (obj.state !== undefined) result.state = obj.state
        if (obj.postalCode !== undefined) result.postal_code = obj.postalCode
        if (obj.countryCode !== undefined) result.country_code = obj.countryCode
        if (obj.taxId !== undefined) result.tax_id = obj.taxId
        if (obj.taxIdType !== undefined) result.tax_id_type = obj.taxIdType
        if (obj.email !== undefined) result.email = obj.email
        if (obj.phone !== undefined) result.phone = obj.phone
        if (obj.website !== undefined) result.website = obj.website
        if (obj.bankName !== undefined) result.bank_name = obj.bankName
        if (obj.bankIban !== undefined) result.bank_iban = obj.bankIban
        if (obj.bankSwift !== undefined) result.bank_swift = obj.bankSwift
        if (obj.bankAccountNumber !== undefined) result.bank_account_number = obj.bankAccountNumber
        if (obj.logoUrl !== undefined) result.logo_url = obj.logoUrl
        if (obj.defaultCurrency !== undefined) result.default_currency = obj.defaultCurrency
        if (obj.defaultPaymentTermsDays !== undefined) result.default_payment_terms_days = obj.defaultPaymentTermsDays
        if (obj.invoicePrefix !== undefined) result.invoice_prefix = obj.invoicePrefix
        return result
    }

    return {
        create: (input) =>
            Effect.tryPromise({
                try: async () => {
                    const { data, error } = await client
                        .from("organizations")
                        .insert(mapToSnakeCase(input))
                        .select()
                        .single()

                    if (error) throw error
                    return mapToCamelCase(data) as typeof Organization.Type
                },
                catch: (cause) => new DatabaseError({ message: "Failed to create organization", cause }),
            }),

        findById: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("organizations").select().eq("id", id)
                    if (orgIdContext) {
                        query = query.eq("id", orgIdContext)
                    }

                    const { data, error } = await query.single()

                    if (error) {
                        if (error.code === "PGRST116") {
                            return null // Not found
                        }
                        throw error
                    }
                    return data
                },
                catch: (cause) => new DatabaseError({ message: "Database query failed", cause }),
            }).pipe(
                Effect.flatMap((data) =>
                    data
                        ? Effect.succeed(mapToCamelCase(data) as typeof Organization.Type)
                        : Effect.fail(new NotFoundError({ message: "Organization not found", id }))
                )
            ),

        update: (id, input, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("organizations").update(mapToSnakeCase(input)).eq("id", id)
                    if (orgIdContext) {
                        query = query.eq("id", orgIdContext)
                    }

                    const { data, error } = await query.select().single()

                    if (error) {
                        if (error.code === "PGRST116") return null
                        throw error
                    }
                    return data
                },
                catch: (cause) => new DatabaseError({ message: "Failed to update organization", cause }),
            }).pipe(
                Effect.flatMap((data) =>
                    data
                        ? Effect.succeed(mapToCamelCase(data) as typeof Organization.Type)
                        : Effect.fail(new NotFoundError({ message: "Organization not found or access denied", id }))
                )
            ),

        list: (orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("organizations").select()
                    if (orgIdContext) {
                        query = query.eq("id", orgIdContext)
                    }

                    const { data, error } = await query

                    if (error) throw error
                    return data.map(mapToCamelCase) as Array<typeof Organization.Type>
                },
                catch: (cause) => new DatabaseError({ message: "Failed to list organizations", cause }),
            }),
    }
})

export const OrganizationServiceLive = Layer.effect(OrganizationService, createOrganizationService)
