import { Context, Effect, Layer } from "effect"
import { DatabaseService } from "./database.js"
import { DatabaseError, NotFoundError } from "../errors/index.js"
import { InvoiceTemplate, CreateTemplate, UpdateTemplate } from "../schemas/template.js"

export class TemplateService extends Context.Tag("TemplateService")<
    TemplateService,
    {
        readonly resolveForInvoice: (orgId: string, requestedTemplateId?: string | null) => Effect.Effect<typeof InvoiceTemplate.Type, DatabaseError | NotFoundError>
        readonly create: (orgId: string, input: typeof CreateTemplate.Type) => Effect.Effect<typeof InvoiceTemplate.Type, DatabaseError>
        readonly findById: (id: string, orgIdContext?: string) => Effect.Effect<typeof InvoiceTemplate.Type, DatabaseError | NotFoundError>
        readonly update: (id: string, input: typeof UpdateTemplate.Type, orgIdContext?: string) => Effect.Effect<typeof InvoiceTemplate.Type, DatabaseError | NotFoundError>
        readonly list: (orgIdContext?: string) => Effect.Effect<Array<typeof InvoiceTemplate.Type>, DatabaseError>
        readonly delete: (id: string, orgIdContext?: string) => Effect.Effect<void, DatabaseError | NotFoundError>
    }
>() { }

const createTemplateService = Effect.gen(function* () {
    const dbService = yield* DatabaseService
    const client = dbService.getAdminClient()

    const mapToCamelCase = (row: any) => ({
        id: row.id,
        orgId: row.org_id,
        name: row.name,
        description: row.description,
        version: row.version,
        isDefault: row.is_default,
        componentCode: row.component_code,
        propsSchema: row.props_schema,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })

    return {
        resolveForInvoice: (orgId, requestedTemplateId) =>
            Effect.tryPromise({
                try: async () => {
                    if (requestedTemplateId) {
                        // Fetch specific template, ensure it belongs to this org or is global
                        const { data, error } = await client
                            .from("invoice_templates")
                            .select()
                            .eq("id", requestedTemplateId)
                            .or(`org_id.eq.${orgId},org_id.is.null`)
                            .single()

                        if (error) {
                            if (error.code === "PGRST116") return null
                            throw error
                        }
                        return data
                    } else {
                        // Find default template: org default first, then global default
                        const { data, error } = await client
                            .from("invoice_templates")
                            .select()
                            .eq("is_default", true)
                            .eq("status", "active")
                            .or(`org_id.eq.${orgId},org_id.is.null`)
                            .order("org_id", { nullsFirst: false }) // Prioritize org-specific over global
                            .limit(1)
                            .single()

                        if (error) {
                            if (error.code === "PGRST116") return null
                            throw error
                        }
                        return data
                    }
                },
                catch: (cause) => new DatabaseError({ message: "Failed to resolve template", cause }),
            }).pipe(
                Effect.flatMap((data) =>
                    data
                        ? Effect.succeed(mapToCamelCase(data) as typeof InvoiceTemplate.Type)
                        : Effect.fail(new NotFoundError({ message: "Template not found" }))
                )
            ),

        create: (orgId, input) =>
            Effect.tryPromise({
                try: async () => {
                    const { data, error } = await client
                        .from("invoice_templates")
                        .insert({
                            org_id: orgId,
                            name: input.name,
                            description: input.description,
                            component_code: input.componentCode,
                            props_schema: input.propsSchema,
                        })
                        .select()
                        .single()

                    if (error) throw error
                    return mapToCamelCase(data) as typeof InvoiceTemplate.Type
                },
                catch: (cause) => new DatabaseError({ message: "Failed to create template", cause }),
            }),

        findById: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("invoice_templates").select().eq("id", id)
                    if (orgIdContext) {
                        // Let orgs view global templates too
                        query = query.or(`org_id.eq.${orgIdContext},org_id.is.null`)
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
                        ? Effect.succeed(mapToCamelCase(data) as typeof InvoiceTemplate.Type)
                        : Effect.fail(new NotFoundError({ message: "Template not found", id }))
                )
            ),

        update: (id, input, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("invoice_templates").update({
                        name: input.name,
                        description: input.description,
                        status: input.status,
                        component_code: input.componentCode,
                        props_schema: input.propsSchema,
                        version: undefined // We could bump version here
                    }).eq("id", id)
                    if (orgIdContext) {
                        query = query.eq("org_id", orgIdContext)
                    }

                    // Bump version
                    const { data: current, error: fetchErr } = await client.from("invoice_templates").select("version").eq("id", id).single()
                    if (fetchErr) throw fetchErr

                    const updatePayload: any = {
                        name: input.name,
                        description: input.description,
                        status: input.status,
                        component_code: input.componentCode,
                        props_schema: input.propsSchema,
                    }

                    if (input.componentCode) {
                        updatePayload.version = current.version + 1
                    }

                    const { data, error } = await client.from("invoice_templates").update(updatePayload).eq("id", id).select().single()

                    if (error) {
                        if (error.code === "PGRST116") return null
                        throw error
                    }
                    return data
                },
                catch: (cause) => new DatabaseError({ message: "Failed to update template", cause }),
            }).pipe(
                Effect.flatMap((data) =>
                    data
                        ? Effect.succeed(mapToCamelCase(data) as typeof InvoiceTemplate.Type)
                        : Effect.fail(new NotFoundError({ message: "Template not found or access denied", id }))
                )
            ),

        list: (orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("invoice_templates").select()
                    if (orgIdContext) {
                        query = query.or(`org_id.eq.${orgIdContext},org_id.is.null`)
                    }

                    const { data, error } = await query

                    if (error) throw error
                    return data.map(mapToCamelCase) as Array<typeof InvoiceTemplate.Type>
                },
                catch: (cause) => new DatabaseError({ message: "Failed to list templates", cause }),
            }),

        delete: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("invoice_templates").update({ status: 'archived' }).eq("id", id)
                    if (orgIdContext) {
                        query = query.eq("org_id", orgIdContext)
                    }

                    const { data, error } = await query.select().single()

                    if (error) {
                        if (error.code === "PGRST116") return null
                        throw error
                    }
                    return data
                },
                catch: (cause) => new DatabaseError({ message: "Failed to delete template", cause }),
            }).pipe(
                Effect.flatMap((data) =>
                    data
                        ? Effect.void
                        : Effect.fail(new NotFoundError({ message: "Template not found or access denied", id }))
                )
            ),
    }
})

export const TemplateServiceLive = Layer.effect(TemplateService, createTemplateService)
