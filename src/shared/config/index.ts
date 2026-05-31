import { Context, Effect, Layer } from "effect"

export interface AppConfig {
  readonly supabaseUrl: string
  readonly supabaseServiceRoleKey: string
  readonly adminApiKey: string
  readonly logLevel: string
  readonly nodeEnv: string
}

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  AppConfig
>() { }

export const makeConfigServiceFromEnv = (env: {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ADMIN_API_KEY: string
  LOG_LEVEL: string
  NODE_ENV: string
}) =>
  Layer.succeed(ConfigService, {
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    adminApiKey: env.ADMIN_API_KEY,
    logLevel: env.LOG_LEVEL || "info",
    nodeEnv: env.NODE_ENV || "production",
  })
