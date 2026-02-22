import { Config, Context, Effect, Layer, Schema } from "effect"

const LogLevel = Schema.Literal("debug", "info", "warn", "error", "fatal")
type LogLevel = typeof LogLevel.Type

const NodeEnv = Schema.Literal("development", "production", "test")
type NodeEnv = typeof NodeEnv.Type

const StorageProvider = Schema.Literal("supabase", "r2")
type StorageProvider = typeof StorageProvider.Type

export interface AppConfig {
  readonly supabaseUrl: string
  readonly supabaseServiceRoleKey: string
  readonly supabaseAnonKey: string
  readonly redisUrl: string
  readonly apiPort: number
  readonly logLevel: LogLevel
  readonly nodeEnv: NodeEnv
  readonly storageProvider: StorageProvider
  readonly r2AccountId: string
  readonly r2AccessKeyId: string
  readonly r2SecretAccessKey: string
  readonly r2BucketName: string
}

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  AppConfig
>() { }

const loadConfig = Effect.gen(function* () {
  const supabaseUrl = yield* Config.string("SUPABASE_URL")
  const supabaseServiceRoleKey = yield* Config.string("SUPABASE_SERVICE_ROLE_KEY")
  const supabaseAnonKey = yield* Config.string("SUPABASE_ANON_KEY")
  const redisUrl = yield* Config.string("REDIS_URL").pipe(
    Config.withDefault("redis://localhost:6379")
  )
  const apiPort = yield* Config.integer("API_PORT").pipe(
    Config.withDefault(3000)
  )
  const logLevelRaw = yield* Config.string("LOG_LEVEL").pipe(
    Config.withDefault("info")
  )
  const logLevel = yield* Schema.decodeUnknown(LogLevel)(logLevelRaw)
  const nodeEnvRaw = yield* Config.string("NODE_ENV").pipe(
    Config.withDefault("development")
  )
  const nodeEnv = yield* Schema.decodeUnknown(NodeEnv)(nodeEnvRaw)

  const storageProviderRaw = yield* Config.string("STORAGE_PROVIDER").pipe(
    Config.withDefault("supabase")
  )
  const storageProvider = yield* Schema.decodeUnknown(StorageProvider)(storageProviderRaw)

  const r2AccountId = yield* Config.string("R2_ACCOUNT_ID").pipe(Config.withDefault(""))
  const r2AccessKeyId = yield* Config.string("R2_ACCESS_KEY_ID").pipe(Config.withDefault(""))
  const r2SecretAccessKey = yield* Config.string("R2_SECRET_ACCESS_KEY").pipe(Config.withDefault(""))
  const r2BucketName = yield* Config.string("R2_BUCKET_NAME").pipe(Config.withDefault(""))

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    supabaseAnonKey,
    redisUrl,
    apiPort,
    logLevel,
    nodeEnv,
    storageProvider,
    r2AccountId,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2BucketName,
  } satisfies AppConfig
})

export const ConfigServiceLive = Layer.effect(ConfigService, loadConfig)
