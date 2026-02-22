import { Data } from "effect"

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
    readonly message: string
    readonly entity?: string
    readonly id?: string
}> { }

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
    readonly message: string
    readonly reason?: string
}> { }

export class ValidationError extends Data.TaggedError("ValidationError")<{
    readonly message: string
    readonly details?: unknown
}> { }

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
    readonly message: string
    readonly cause: unknown
}> { }

export class StorageError extends Data.TaggedError("StorageError")<{
    readonly message: string
    readonly cause: unknown
}> { }

export class QueueError extends Data.TaggedError("QueueError")<{
    readonly message: string
    readonly cause: unknown
}> { }

export class PdfRenderError extends Data.TaggedError("PdfRenderError")<{
    readonly message: string
    readonly cause: unknown
}> { }

export class CallbackError extends Data.TaggedError("CallbackError")<{
    readonly message: string
    readonly cause: unknown
}> { }

export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
    readonly message: string
}> { }
