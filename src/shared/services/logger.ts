import { Context, Effect, Layer } from "effect"

export class LoggerService extends Context.Tag("LoggerService")<
    LoggerService,
    {
        readonly info: (msg: string, obj?: unknown) => Effect.Effect<void>
        readonly error: (msg: string, obj?: unknown) => Effect.Effect<void>
        readonly warn: (msg: string, obj?: unknown) => Effect.Effect<void>
        readonly debug: (msg: string, obj?: unknown) => Effect.Effect<void>
        readonly fatal: (msg: string, obj?: unknown) => Effect.Effect<void>
    }
>() { }

const formatLog = (level: string, msg: string, obj?: unknown) =>
    JSON.stringify({ level, msg, ...(obj && typeof obj === "object" ? obj : { data: obj }), timestamp: new Date().toISOString() })

export const LoggerServiceLive = Layer.succeed(LoggerService, {
    info: (msg, obj?) => Effect.sync(() => console.log(formatLog("info", msg, obj))),
    error: (msg, obj?) => Effect.sync(() => console.error(formatLog("error", msg, obj))),
    warn: (msg, obj?) => Effect.sync(() => console.warn(formatLog("warn", msg, obj))),
    debug: (msg, obj?) => Effect.sync(() => console.debug(formatLog("debug", msg, obj))),
    fatal: (msg, obj?) => Effect.sync(() => console.error(formatLog("fatal", msg, obj))),
})
