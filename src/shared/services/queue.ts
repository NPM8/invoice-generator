import { Context, Effect, Layer } from "effect"
import { QueueError } from "../errors/index.js"
import type { QueueMessage } from "../types/queue-messages.js"

export class QueueService extends Context.Tag("QueueService")<
    QueueService,
    {
        readonly enqueuePdfGeneration: (
            invoiceId: string
        ) => Effect.Effect<void, QueueError>
        readonly enqueueCallbackDelivery: (
            invoiceId: string
        ) => Effect.Effect<void, QueueError>
    }
>() { }

export const makeQueueService = (queue: Queue) =>
    Layer.succeed(QueueService, {
        enqueuePdfGeneration: (invoiceId: string) =>
            Effect.tryPromise({
                try: () =>
                    queue.send({ type: "pdf-generation", invoiceId } satisfies QueueMessage),
                catch: (cause) => new QueueError({ message: "Failed to enqueue PDF generation", cause }),
            }),

        enqueueCallbackDelivery: (invoiceId: string) =>
            Effect.tryPromise({
                try: () =>
                    queue.send({ type: "callback-delivery", invoiceId } satisfies QueueMessage),
                catch: (cause) => new QueueError({ message: "Failed to enqueue callback delivery", cause }),
            }),
    })
