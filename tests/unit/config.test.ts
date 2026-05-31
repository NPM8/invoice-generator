import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { ConfigService, makeConfigServiceFromEnv } from "../../src/shared/config/index.js"

describe("ConfigService", () => {
    it("creates config from env object", async () => {
        const env = {
            SUPABASE_URL: "http://test-url.com",
            SUPABASE_SERVICE_ROLE_KEY: "test-seckey",
            ADMIN_API_KEY: "test-admin-key",
            LOG_LEVEL: "debug",
            NODE_ENV: "test",
        }

        const TestLayer = makeConfigServiceFromEnv(env)

        const program = Effect.gen(function* () {
            const config = yield* ConfigService
            expect(config.supabaseUrl).toBe("http://test-url.com")
            expect(config.supabaseServiceRoleKey).toBe("test-seckey")
            expect(config.adminApiKey).toBe("test-admin-key")
            expect(config.logLevel).toBe("debug")
            expect(config.nodeEnv).toBe("test")
        })

        await Effect.runPromise(Effect.provide(program, TestLayer))
    })

    it("falls back to default values for LOG_LEVEL and NODE_ENV", async () => {
        const env = {
            SUPABASE_URL: "http://test-url.com",
            SUPABASE_SERVICE_ROLE_KEY: "test-seckey",
            ADMIN_API_KEY: "admin-key",
            LOG_LEVEL: "",
            NODE_ENV: "",
        }

        const TestLayer = makeConfigServiceFromEnv(env)

        const program = Effect.gen(function* () {
            const config = yield* ConfigService
            expect(config.logLevel).toBe("info")
            expect(config.nodeEnv).toBe("production")
        })

        await Effect.runPromise(Effect.provide(program, TestLayer))
    })
})
