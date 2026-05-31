import { describe, it, expect } from "bun:test"
import { Effect, Layer, Either } from "effect"
import { StorageService, makeStorageService } from "../../src/shared/services/storage.js"
import { StorageError } from "../../src/shared/errors/index.js"

const createMockR2Bucket = (opts?: { shouldFail?: boolean }): R2Bucket => ({
    put: async (_key: string, _value: any) => {
        if (opts?.shouldFail) throw new Error("R2 put failed")
        return {} as any
    },
    get: async () => null,
    delete: async () => {},
    list: async () => ({ objects: [], truncated: false, delimitedPrefixes: [] }) as any,
    head: async () => null,
    createMultipartUpload: async () => ({} as any),
    resumeMultipartUpload: () => ({} as any),
}) as unknown as R2Bucket

describe("StorageService (R2 binding)", () => {
    it("uploads a PDF via R2 binding successfully", async () => {
        const mockBucket = createMockR2Bucket()
        const TestLayer = makeStorageService(mockBucket)

        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const result = yield* Effect.either(service.uploadPdf("test.pdf", new Uint8Array([1, 2, 3])))
            expect(Either.isRight(result)).toBe(true)
        })

        await Effect.runPromise(Effect.provide(program, TestLayer))
    })

    it("handles R2 upload errors", async () => {
        const mockBucket = createMockR2Bucket({ shouldFail: true })
        const TestLayer = makeStorageService(mockBucket)

        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const result = yield* Effect.either(service.uploadPdf("test.pdf", new Uint8Array([1, 2, 3])))
            expect(Either.isLeft(result)).toBe(true)
            if (Either.isLeft(result)) {
                expect(result.left).toBeInstanceOf(StorageError)
                expect(result.left.message).toBe("Failed to upload PDF to R2")
            }
        })

        await Effect.runPromise(Effect.provide(program, TestLayer))
    })

    it("returns the auth-scoped download route URL for getSignedUrl", async () => {
        const mockBucket = createMockR2Bucket()
        const TestLayer = makeStorageService(mockBucket)

        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const url = yield* service.getSignedUrl("invoices/org-1/inv-1.pdf")
            expect(url).toBe("/api/v1/invoices/inv-1/pdf/download")
        })

        await Effect.runPromise(Effect.provide(program, TestLayer))
    })

    it("getPdf returns bytes when the object exists", async () => {
        const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])
        const bucket = {
            ...createMockR2Bucket(),
            get: async (_key: string) => ({ arrayBuffer: async () => bytes.buffer }) as any,
        } as unknown as R2Bucket
        const TestLayer = makeStorageService(bucket)

        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const result = yield* service.getPdf("invoices/org-1/inv-1.pdf")
            expect(result).toEqual(bytes)
        })

        await Effect.runPromise(Effect.provide(program, TestLayer))
    })

    it("getPdf fails with NotFoundError when the object is missing", async () => {
        const mockBucket = createMockR2Bucket() // get returns null
        const TestLayer = makeStorageService(mockBucket)

        const program = Effect.gen(function* () {
            const service = yield* StorageService
            const result = yield* Effect.either(service.getPdf("invoices/org-1/missing.pdf"))
            expect(Either.isLeft(result)).toBe(true)
            if (Either.isLeft(result)) {
                expect(result.left._tag).toBe("NotFoundError")
            }
        })

        await Effect.runPromise(Effect.provide(program, TestLayer))
    })
})
