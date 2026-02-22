import { Context, Effect, Layer } from "effect"
import { Worker, Job } from "bullmq"
import Redis from "ioredis"
import { ConfigService } from "../../shared/config/index.js"
import { LoggerService } from "../../shared/services/logger.js"
import { CallbackService } from "../../shared/services/callback.js"

export const CallbackWorkerLive = Layer.scopedDiscard(
    Effect.gen(function* () {
        const config = yield* ConfigService
        const logger = yield* LoggerService
        const callbackService = yield* CallbackService

        const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null })

        const worker = new Worker(
            "callback-delivery",
            async (job: Job) => {
                const { invoiceId } = job.data

                const runEffect = Effect.gen(function* () {
                    yield* callbackService.deliver(invoiceId)
                }).pipe(
                    Effect.catchAll((cause) => {
                        return Effect.sync(() => { throw cause })
                    })
                )

                try {
                    await Effect.runPromise(runEffect)
                    logger.info(`Callback delivered for invoice ${invoiceId}`)
                } catch (e: any) {
                    logger.error(`Callback failed for invoice ${invoiceId}: ${e?.message}`, e)
                    throw e
                }
            },
            { connection, concurrency: 10 }
        )

        yield* Effect.addFinalizer(() =>
            Effect.tryPromise(() => worker.close())
        )
    })
)
