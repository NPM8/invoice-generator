import { Context, Effect, Layer } from "effect"
import pino from "pino"
import { ConfigService } from "../config/index.js"

export class LoggerService extends Context.Tag("LoggerService")<
    LoggerService,
    {
        readonly info: (msg: string, obj?: any) => Effect.Effect<void>
        readonly error: (msg: string, obj?: any) => Effect.Effect<void>
        readonly warn: (msg: string, obj?: any) => Effect.Effect<void>
        readonly debug: (msg: string, obj?: any) => Effect.Effect<void>
        readonly fatal: (msg: string, obj?: any) => Effect.Effect<void>
    }
>() { }

const createLogger = Effect.gen(function* () {
    const config = yield* ConfigService

    const logger = pino({
        level: config.logLevel,
        transport:
            config.nodeEnv === "development"
                ? {
                    target: "pino-pretty",
                    options: {
                        colorize: true,
                    },
                }
                : undefined,
    })

    return {
        info: (msg: string, obj?: any) => Effect.sync(() => logger.info(obj || {}, msg)),
        error: (msg: string, obj?: any) => Effect.sync(() => logger.error(obj || {}, msg)),
        warn: (msg: string, obj?: any) => Effect.sync(() => logger.warn(obj || {}, msg)),
        debug: (msg: string, obj?: any) => Effect.sync(() => logger.debug(obj || {}, msg)),
        fatal: (msg: string, obj?: any) => Effect.sync(() => logger.fatal(obj || {}, msg)),
    }
})

export const LoggerServiceLive = Layer.effect(LoggerService, createLogger)
