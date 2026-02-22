import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { ConfigService, ConfigServiceLive } from "../../src/shared/config/index.js"

describe("ConfigService", () => {
    it("loads config properly from env vars", async () => {
        Bun.env.SUPABASE_URL = "http://test-url.com"
        Bun.env.SUPABASE_SERVICE_ROLE_KEY = "test-seckey"
        Bun.env.SUPABASE_ANON_KEY = "test-anonkey"
        Bun.env.REDIS_URL = "redis://host"
        Bun.env.API_PORT = "4000"
        Bun.env.LOG_LEVEL = "debug"
        Bun.env.NODE_ENV = "test"
        Bun.env.STORAGE_PROVIDER = "r2"
        Bun.env.R2_ACCOUNT_ID = "acc-123"
        Bun.env.R2_ACCESS_KEY_ID = "akey"
        Bun.env.R2_SECRET_ACCESS_KEY = "skey"
        Bun.env.R2_BUCKET_NAME = "test-bucket"

        const program = Effect.gen(function* () {
            const config = yield* ConfigService
            expect(config.supabaseUrl).toBe("http://test-url.com")
            expect(config.supabaseServiceRoleKey).toBe("test-seckey")
            expect(config.storageProvider).toBe("r2")
            expect(config.r2AccountId).toBe("acc-123")
            expect(config.apiPort).toBe(4000)
            expect(config.logLevel).toBe("debug")
            expect(config.nodeEnv).toBe("test")
        })

        await Effect.runPromise(Effect.provide(program, ConfigServiceLive))
    })

    it("falls back to default configurations", async () => {
        delete Bun.env.REDIS_URL
        delete Bun.env.API_PORT
        delete Bun.env.LOG_LEVEL
        delete Bun.env.NODE_ENV
        delete Bun.env.STORAGE_PROVIDER
        delete Bun.env.R2_ACCOUNT_ID
        delete Bun.env.R2_ACCESS_KEY_ID
        delete Bun.env.R2_SECRET_ACCESS_KEY
        delete Bun.env.R2_BUCKET_NAME

        const program = Effect.gen(function* () {
            const config = yield* ConfigService
            expect(config.redisUrl).toBe("redis://localhost:6379")
            expect(config.apiPort).toBe(3000)
            expect(config.logLevel).toBe("info")
            expect(config.nodeEnv).toBe("development")
            expect(config.storageProvider).toBe("supabase")
            expect(config.r2AccountId).toBe("")
        })

        await Effect.runPromise(Effect.provide(program, ConfigServiceLive))
    })
})
