import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Context, Effect, Layer } from "effect"
import { ConfigService } from "../config/index.js"

export class DatabaseService extends Context.Tag("DatabaseService")<
    DatabaseService,
    {
        readonly client: SupabaseClient
        // For worker operations and generic access
        readonly getAdminClient: () => SupabaseClient
        // For API operations, if we can sign a JWT or just use admin client + explicit .eq()
        readonly getOrgClient: (orgId: string) => Effect.Effect<SupabaseClient>
    }
>() { }

const createDatabaseService = Effect.gen(function* () {
    const config = yield* ConfigService

    // Create the main admin client using the service role key
    const adminClient = createClient(
        config.supabaseUrl,
        config.supabaseServiceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )

    // We could create an org-scoped client if we had a JWT signing mechanism,
    // but lacking the JWT secret natively, we will either return the admin client
    // and rely on repository logic to append `.eq('org_id', orgId)` or implement
    // a custom fetcher. For now, we return the admin client and will enforce 
    // org isolation in the services.
    return {
        client: adminClient,
        getAdminClient: () => adminClient,
        getOrgClient: (orgId: string) => Effect.succeed(adminClient),
    }
})

export const DatabaseServiceLive = Layer.effect(
    DatabaseService,
    createDatabaseService
)
