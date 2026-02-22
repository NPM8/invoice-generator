import { Context, Effect, Layer } from "effect"
import { DatabaseService } from "./database.js"
import { DatabaseError, CallbackError } from "../errors/index.js"

export class CallbackService extends Context.Tag("CallbackService")<
    CallbackService,
    {
        readonly deliver: (invoiceId: string) => Effect.Effect<void, DatabaseError | CallbackError>
    }
>() { }

const createCallbackService = Effect.gen(function* () {
    const dbService = yield* DatabaseService
    const client = dbService.getAdminClient()

    return {
        deliver: (invoiceId) =>
            Effect.gen(function* () {
                const fetchResult = yield* Effect.tryPromise({
                    try: async () => {
                        const { data, error } = await client.from("invoices").select("callback_url, status, pdf_url").eq("id", invoiceId).single()
                        if (error) throw error
                        return data
                    },
                    catch: (cause) => new DatabaseError({ message: "Failed to fetch callback details", cause })
                })

                if (!fetchResult.callback_url) {
                    return // Nothing to do
                }

                const payload = {
                    invoiceId,
                    status: fetchResult.status,
                    pdfUrl: fetchResult.pdf_url,
                    completedAt: new Date().toISOString()
                }

                const deliverResult = yield* Effect.tryPromise({
                    try: async () => {
                        const controller = new AbortController()
                        const id = setTimeout(() => controller.abort(), 10000)

                        const req = await fetch(fetchResult.callback_url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                            signal: controller.signal
                        })

                        clearTimeout(id)

                        if (!req.ok) {
                            throw new Error(`Endpoint returned status ${req.status}`)
                        }

                        return true
                    },
                    catch: (cause) => new CallbackError({ message: "Callback request failed", cause })
                }).pipe(
                    Effect.either
                )

                const isSuccess = deliverResult._tag === "Right"

                yield* Effect.tryPromise({
                    try: async () => {
                        // Increment attempts
                        const { data: current } = await client.from("invoices").select("callback_attempts").eq("id", invoiceId).single()
                        const attempts = (current?.callback_attempts || 0) + 1

                        await client.from("invoices").update({
                            callback_status: isSuccess ? "delivered" : "failed",
                            callback_attempts: attempts,
                            callback_last_attempt: new Date().toISOString()
                        }).eq("id", invoiceId)
                    },
                    catch: (cause) => new DatabaseError({ message: "Failed to update callback status", cause })
                })

                if (!isSuccess) {
                    yield* Effect.fail(deliverResult.left)
                }
            })
    }
})

export const CallbackServiceLive = Layer.effect(CallbackService, createCallbackService)
