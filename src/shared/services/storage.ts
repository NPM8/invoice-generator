import { Context, Effect, Layer } from "effect"
import { StorageError, NotFoundError } from "../errors/index.js"

export class StorageService extends Context.Tag("StorageService")<
    StorageService,
    {
        readonly uploadPdf: (
            path: string,
            pdfBuffer: Uint8Array,
            contentType?: string
        ) => Effect.Effect<void, StorageError>
        readonly getSignedUrl: (
            path: string,
            expiresIn?: number
        ) => Effect.Effect<string, StorageError>
        readonly getPdf: (
            path: string
        ) => Effect.Effect<Uint8Array, StorageError | NotFoundError>
    }
>() { }

export const makeStorageService = (bucket: R2Bucket) =>
    Layer.succeed(StorageService, {
        uploadPdf: (path: string, pdfBuffer: Uint8Array, contentType = "application/pdf") =>
            Effect.tryPromise({
                try: () => bucket.put(path, pdfBuffer, {
                    httpMetadata: { contentType },
                }),
                catch: (cause) => new StorageError({ message: "Failed to upload PDF to R2", cause }),
            }).pipe(Effect.asVoid),

        getSignedUrl: (path: string, _expiresIn = 3600) => {
            // R2 bindings can't presign. The PDF is served by the auth-scoped
            // download route, which derives the same R2 key from {orgId,id}.
            // path is "invoices/{orgId}/{invoiceId}.pdf" — recover the invoice id.
            const id = (path.split("/").pop() ?? "").replace(/\.pdf$/, "")
            return Effect.succeed(`/api/v1/invoices/${id}/pdf/download`)
        },

        getPdf: (path: string) =>
            Effect.tryPromise({
                try: async () => {
                    const object = await bucket.get(path)
                    if (!object) return null
                    return new Uint8Array(await object.arrayBuffer())
                },
                catch: (cause) => new StorageError({ message: "Failed to read PDF from R2", cause }),
            }).pipe(
                Effect.flatMap((bytes) =>
                    bytes
                        ? Effect.succeed(bytes)
                        : Effect.fail(new NotFoundError({ message: "PDF object not found", id: path }))
                )
            ),
    })
