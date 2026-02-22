import { Context, Effect, Layer } from "effect"
import crypto from "crypto"
import { DatabaseService } from "./database.js"
import { DatabaseError, NotFoundError, UnauthorizedError } from "../errors/index.js"
import { ApiKeyResponse, ApiKeyWithSecret, CreateApiKey } from "../schemas/api-key.js"

export class ApiKeyService extends Context.Tag("ApiKeyService")<
    ApiKeyService,
    {
        readonly generate: (input: typeof CreateApiKey.Type) => Effect.Effect<typeof ApiKeyWithSecret.Type, DatabaseError>
        readonly validate: (keyString: string) => Effect.Effect<{ orgId: string, scopes: string[] }, DatabaseError | UnauthorizedError>
        readonly revoke: (id: string, orgIdContext?: string) => Effect.Effect<void, DatabaseError | NotFoundError>
        readonly regenerate: (id: string, orgIdContext?: string) => Effect.Effect<typeof ApiKeyWithSecret.Type, DatabaseError | NotFoundError>
        readonly list: (orgIdContext?: string) => Effect.Effect<Array<typeof ApiKeyResponse.Type>, DatabaseError>
        readonly remove: (id: string, orgIdContext?: string) => Effect.Effect<void, DatabaseError | NotFoundError>
    }
>() { }

const createApiKeyService = Effect.gen(function* () {
    const dbService = yield* DatabaseService
    const client = dbService.getAdminClient()

    const mapToCamelCase = (row: any) => ({
        id: row.id,
        orgId: row.org_id,
        keyPrefix: row.key_prefix,
        name: row.name,
        status: row.status,
        scopes: row.scopes,
        rateLimit: row.rate_limit,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        revokedAt: row.revoked_at,
        createdBy: row.created_by,
    })

    const hashKey = (key: string) => crypto.createHash("sha256").update(key).digest("hex")

    return {
        generate: (input) =>
            Effect.tryPromise({
                try: async () => {
                    const rawKey = `inv_${crypto.randomUUID().replace(/-/g, "")}`
                    const keyPrefix = rawKey.substring(0, 8)
                    const keyHash = hashKey(rawKey)

                    const { data, error } = await client
                        .from("api_keys")
                        .insert({
                            org_id: input.orgId,
                            name: input.name,
                            scopes: input.scopes,
                            expires_at: input.expiresAt,
                            key_prefix: keyPrefix,
                            key_hash: keyHash,
                        })
                        .select()
                        .single()

                    if (error) throw error

                    return {
                        ...mapToCamelCase(data),
                        key: rawKey,
                    } as typeof ApiKeyWithSecret.Type
                },
                catch: (cause) => new DatabaseError({ message: "Failed to create API key", cause }),
            }),

        validate: (keyString) =>
            Effect.tryPromise({
                try: async () => {
                    if (!keyString.startsWith("inv_")) {
                        return { valid: false as const }
                    }

                    const prefix = keyString.substring(0, 8)
                    const providedHash = hashKey(keyString)

                    const { data, error } = await client
                        .from("api_keys")
                        .select()
                        .eq("key_prefix", prefix)
                        .eq("status", "active")
                        .single()

                    if (error) {
                        if (error.code === "PGRST116") return { valid: false as const }
                        throw error
                    }

                    // Timing safe equality check to prevent timing attacks
                    const isMatch = crypto.timingSafeEqual(
                        Buffer.from(providedHash, 'hex'),
                        Buffer.from(data.key_hash, 'hex')
                    )

                    if (!isMatch) return { valid: false as const }

                    // Check expiration
                    if (data.expires_at && new Date(data.expires_at) < new Date()) {
                        return { valid: false as const }
                    }

                    // Update last used at in background
                    client.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then()

                    return { valid: true as const, orgId: data.org_id, scopes: data.scopes }
                },
                catch: (cause) => new DatabaseError({ message: "Failed to validate API key", cause }),
            }).pipe(
                Effect.flatMap((result) =>
                    result.valid
                        ? Effect.succeed({ orgId: result.orgId, scopes: result.scopes })
                        : Effect.fail(new UnauthorizedError({ message: "Invalid API key" }))
                )
            ),

        revoke: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("api_keys").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", id)
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
                catch: (cause) => new DatabaseError({ message: "Failed to revoke API key", cause }),
            }).pipe(
                Effect.flatMap((data) =>
                    data
                        ? Effect.void
                        : Effect.fail(new NotFoundError({ message: "API key not found or access denied", id }))
                )
            ),

        regenerate: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("api_keys").select().eq("id", id)
                    if (orgIdContext) {
                        query = query.eq("org_id", orgIdContext)
                    }

                    const { data: oldKey, error } = await query.single()

                    if (error) {
                        if (error.code === "PGRST116") return null
                        throw error
                    }

                    // Revoke old
                    await client.from("api_keys").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", id)

                    // Generate new
                    const rawKey = `inv_${crypto.randomUUID().replace(/-/g, "")}`
                    const keyPrefix = rawKey.substring(0, 8)
                    const keyHash = hashKey(rawKey)

                    const { data: newKeyData, error: insertError } = await client
                        .from("api_keys")
                        .insert({
                            org_id: oldKey.org_id,
                            name: oldKey.name,
                            scopes: oldKey.scopes,
                            expires_at: oldKey.expires_at,
                            key_prefix: keyPrefix,
                            key_hash: keyHash,
                        })
                        .select()
                        .single()

                    if (insertError) throw insertError

                    return {
                        keyParams: newKeyData,
                        rawKey,
                    }
                },
                catch: (cause) => new DatabaseError({ message: "Failed to regenerate API key", cause }),
            }).pipe(
                Effect.flatMap((result) =>
                    result
                        ? Effect.succeed({
                            ...mapToCamelCase(result.keyParams),
                            key: result.rawKey,
                        } as typeof ApiKeyWithSecret.Type)
                        : Effect.fail(new NotFoundError({ message: "API key not found or access denied", id }))
                )
            ),

        list: (orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("api_keys").select()
                    if (orgIdContext) query = query.eq("org_id", orgIdContext)

                    const { data, error } = await query

                    if (error) throw error
                    return data.map(mapToCamelCase) as Array<typeof ApiKeyResponse.Type>
                },
                catch: (cause) => new DatabaseError({ message: "Failed to list API keys", cause }),
            }),

        remove: (id, orgIdContext) =>
            Effect.tryPromise({
                try: async () => {
                    let query = client.from("api_keys").delete().eq("id", id)
                    if (orgIdContext) query = query.eq("org_id", orgIdContext)

                    const { data, error } = await query.select()

                    if (error) throw error
                    return data.length > 0 ? true : null
                },
                catch: (cause) => new DatabaseError({ message: "Failed to remove API key", cause }),
            }).pipe(
                Effect.flatMap((found) =>
                    found
                        ? Effect.void
                        : Effect.fail(new NotFoundError({ message: "API key not found or access denied", id }))
                )
            )
    }
})

export const ApiKeyServiceLive = Layer.effect(ApiKeyService, createApiKeyService)
