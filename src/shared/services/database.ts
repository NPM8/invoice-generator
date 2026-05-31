import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Context, Effect, Layer } from "effect"
import { ConfigService } from "../config/index.js"

export class DatabaseService extends Context.Tag("DatabaseService")<
    DatabaseService,
    {
        readonly client: SupabaseClient
        readonly getAdminClient: () => SupabaseClient
        readonly getOrgClient: (orgId: string) => Effect.Effect<SupabaseClient>
    }
>() { }

const createDatabaseService = Effect.gen(function* () {
    const config = yield* ConfigService

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
