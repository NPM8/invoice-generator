import { Effect, ManagedRuntime } from "effect"
import { makeWorkerLayer } from "./layers/index.js"
import { handlePdfGeneration } from "./processors/pdf-generation.js"
import { handleCallbackDelivery } from "./processors/callback-delivery.js"
import type { Env } from "../shared/types/env.js"
import type { QueueMessage } from "../shared/types/queue-messages.js"

let runtime: ManagedRuntime.ManagedRuntime<any, never> | null = null

export default {
    async queue(
        batch: MessageBatch<QueueMessage>,
        env: Env,
        ctx: ExecutionContext
    ): Promise<void> {
        if (!runtime) {
            runtime = ManagedRuntime.make(makeWorkerLayer(env))
        }

        for (const message of batch.messages) {
            try {
                switch (message.body.type) {
                    case "pdf-generation":
                        await runtime.runPromise(
                            handlePdfGeneration(message.body.invoiceId)
                        )
                        message.ack()
                        break

                    case "callback-delivery":
                        await runtime.runPromise(
                            handleCallbackDelivery(message.body.invoiceId)
                        )
                        message.ack()
                        break

                    default:
                        console.warn("Unknown message type", message.body)
                        message.ack()
                }
            } catch (error) {
                console.error(
                    `Failed to process ${message.body.type} for invoice ${message.body.invoiceId}`,
                    error
                )
                message.retry({
                    delaySeconds: Math.min(300, 2 ** message.attempts * 2),
                })
            }
        }
    },
}
