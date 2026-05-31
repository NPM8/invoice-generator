import { Effect } from "effect"
import { CallbackService } from "../../shared/services/callback.js"
import { LoggerService } from "../../shared/services/logger.js"

export const handleCallbackDelivery = (invoiceId: string) =>
    Effect.gen(function* () {
        const callbackService = yield* CallbackService
        const logger = yield* LoggerService

        yield* callbackService.deliver(invoiceId)

        yield* logger.info(`Callback delivered for invoice ${invoiceId}`)
    })
