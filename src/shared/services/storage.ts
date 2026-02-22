import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Context, Effect, Layer, Data } from "effect"
import { ConfigService } from "../config/index.js"
import { StorageError } from "../errors/index.js"
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export class StorageService extends Context.Tag("StorageService")<
    StorageService,
    {
        readonly uploadPdf: (
            path: string,
            pdfBuffer: Buffer,
            contentType?: string
        ) => Effect.Effect<void, StorageError>
        readonly getSignedUrl: (
            path: string,
            expiresIn?: number
        ) => Effect.Effect<string, StorageError>
    }
>() { }

const createStorageService = Effect.gen(function* () {
    const config = yield* ConfigService

    const BUCKET_NAME = "invoices"

    if (config.storageProvider === "r2") {
        const s3Client = new S3Client({
            region: "auto",
            endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.r2AccessKeyId,
                secretAccessKey: config.r2SecretAccessKey,
            },
        })
        const r2BucketName = config.r2BucketName || BUCKET_NAME

        return {
            uploadPdf: (path: string, pdfBuffer: Buffer, contentType = "application/pdf") =>
                Effect.tryPromise({
                    try: async () => {
                        const command = new PutObjectCommand({
                            Bucket: r2BucketName,
                            Key: path,
                            Body: pdfBuffer,
                            ContentType: contentType,
                        })
                        await s3Client.send(command)
                    },
                    catch: (cause) => new StorageError({ message: "Failed to upload PDF to R2", cause }),
                }),

            getSignedUrl: (path: string, expiresIn = 3600) =>
                Effect.tryPromise({
                    try: async () => {
                        const command = new GetObjectCommand({
                            Bucket: r2BucketName,
                            Key: path,
                        })
                        const url = await getSignedUrl(s3Client, command, { expiresIn })
                        return url
                    },
                    catch: (cause) => new StorageError({ message: "Failed to generate signed URL for R2", cause }),
                }),
        }
    }

    const client = createClient(
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
        uploadPdf: (path: string, pdfBuffer: Buffer, contentType = "application/pdf") =>
            Effect.tryPromise({
                try: async () => {
                    const { error } = await client.storage
                        .from(BUCKET_NAME)
                        .upload(path, pdfBuffer, {
                            contentType,
                            upsert: true,
                        })
                    if (error) throw error
                },
                catch: (cause) => new StorageError({ message: "Failed to upload PDF", cause }),
            }),

        getSignedUrl: (path: string, expiresIn = 3600) =>
            Effect.tryPromise({
                try: async () => {
                    const { data, error } = await client.storage
                        .from(BUCKET_NAME)
                        .createSignedUrl(path, expiresIn)
                    if (error) throw error
                    if (!data?.signedUrl) throw new Error("No signed URL in response")
                    return data.signedUrl
                },
                catch: (cause) => new StorageError({ message: "Failed to generate signed URL", cause }),
            }),
    }
})

export const StorageServiceLive = Layer.effect(
    StorageService,
    createStorageService
)
