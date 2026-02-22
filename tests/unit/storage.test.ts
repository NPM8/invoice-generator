import { describe, it, expect } from "bun:test"
import { Effect, Layer, Either } from "effect"
import { StorageService, StorageServiceLive } from "../../src/shared/services/storage.js"
import { ConfigService, AppConfig } from "../../src/shared/config/index.js"
import { StorageError } from "../../src/shared/errors/index.js"

const createMockConfig = (provider: AppConfig["storageProvider"]): typeof ConfigService.Service => ({
    supabaseUrl: "http://localhost:54321",
    supabaseServiceRoleKey: "key",
    supabaseAnonKey: "anon",
    redisUrl: "redis",
    apiPort: 3000,
    logLevel: "info",
    nodeEnv: "test",
    storageProvider: provider,
    r2AccountId: "acc",
    r2AccessKeyId: "r2-key",
    r2SecretAccessKey: "r2-secret",
    r2BucketName: "r2-bucket"
})

describe("StorageService (Supabase)", () => {
    const MockConfig = Layer.succeed(ConfigService, createMockConfig("supabase"))
    const TestLayer = StorageServiceLive.pipe(Layer.provide(MockConfig))

    it("initializes and handles uploadPdf errors", async () => {
        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const result = yield* Effect.either(service.uploadPdf("test.pdf", Buffer.from("test")))

            expect(Either.isLeft(result)).toBe(true)
            if (Either.isLeft(result)) {
                expect(result.left).toBeInstanceOf(StorageError)
                expect(result.left.message).toBe("Failed to upload PDF")
            }
        })
        await Effect.runPromise(Effect.provide(program, TestLayer))
    })

    it("initializes and handles getSignedUrl errors", async () => {
        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const result = yield* Effect.either(service.getSignedUrl("test.pdf"))

            expect(Either.isLeft(result)).toBe(true)
            if (Either.isLeft(result)) {
                expect(result.left).toBeInstanceOf(StorageError)
                expect(result.left.message).toBe("Failed to generate signed URL")
            }
        })
        await Effect.runPromise(Effect.provide(program, TestLayer))
    })
})

describe("StorageService (R2)", () => {
    const MockConfig = Layer.succeed(ConfigService, createMockConfig("r2"))
    const TestLayer = StorageServiceLive.pipe(Layer.provide(MockConfig))

    it("initializes and handles uploadPdf errors for R2", async () => {
        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const result = yield* Effect.either(service.uploadPdf("test.pdf", Buffer.from("test")))

            expect(Either.isLeft(result)).toBe(true)
            if (Either.isLeft(result)) {
                expect(result.left).toBeInstanceOf(StorageError)
                expect(result.left.message).toBe("Failed to upload PDF to R2")
            }
        })
        await Effect.runPromise(Effect.provide(program, TestLayer))
    })

    it("initializes and handles getSignedUrl errors for R2", async () => {
        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const result = yield* Effect.either(service.getSignedUrl("test.pdf"))

            // For getSignedUrl with standard Presigner, it does not actually hit the network,
            // so it might actually succeed and return a signed URL synchronously!
            if (Either.isRight(result)) {
                expect(typeof result.right).toBe("string")
                expect(result.right).toContain("acc.r2.cloudflarestorage.com")
            } else {
                expect(result.left).toBeInstanceOf(StorageError)
                expect(result.left.message).toBe("Failed to generate signed URL for R2")
            }
        })
        await Effect.runPromise(Effect.provide(program, TestLayer))
    })
})
