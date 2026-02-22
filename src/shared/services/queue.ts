import { Queue } from "bullmq"
import { Context, Effect, Layer } from "effect"
import Redis from "ioredis"
import { ConfigService } from "../config/index.js"
import { QueueError } from "../errors/index.js"

export class QueueService extends Context.Tag("QueueService")<
    QueueService,
    {
        readonly enqueuePdfGeneration: (
            jobId: string,
            invoiceId: string
        ) => Effect.Effect<void, QueueError>
        readonly enqueueCallbackDelivery: (
            jobId: string,
            invoiceId: string
        ) => Effect.Effect<void, QueueError>
    }
>() { }

const createQueueService = Effect.gen(function* () {
    const config = yield* ConfigService

    const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null })

    const pdfQueue = new Queue("pdf-generation", { connection })
    const callbackQueue = new Queue("callback-delivery", { connection })

    return {
        enqueuePdfGeneration: (jobId: string, invoiceId: string) =>
            Effect.tryPromise({
                try: async () => {
                    await pdfQueue.add(
                        "generate-pdf",
                        { invoiceId },
                        {
                            jobId,
                            attempts: 5,
                            backoff: {
                                type: "exponential",
                                delay: 2000,
                            },
                        }
                    )
                },
                catch: (cause) => new QueueError({ message: "Failed to enqueue PDF generation", cause }),
            }),

        enqueueCallbackDelivery: (jobId: string, invoiceId: string) =>
            Effect.tryPromise({
                try: async () => {
                    await callbackQueue.add(
                        "deliver-callback",
                        { invoiceId },
                        {
                            jobId,
                            attempts: 8,
                            backoff: {
                                type: "exponential",
                                delay: 3000,
                            },
                        }
                    )
                },
                catch: (cause) => new QueueError({ message: "Failed to enqueue callback delivery", cause }),
            }),
    }
})

export const QueueServiceLive = Layer.scoped(
    QueueService,
    Effect.acquireRelease(
        createQueueService,
        // Note: We should ideally close the queues on teardown
        // For now, it's safe to just let them be discarded if it's a singleton
        (service) => Effect.void
    )
)
