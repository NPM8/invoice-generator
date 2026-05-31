import { Schema } from "effect"

export class NotFoundError extends Schema.TaggedError<NotFoundError>()("NotFoundError", {
    message: Schema.String,
    entity: Schema.optional(Schema.String),
    id: Schema.optional(Schema.String),
}) { }

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()("UnauthorizedError", {
    message: Schema.String,
    reason: Schema.optional(Schema.String),
}) { }

export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
    message: Schema.String,
    details: Schema.optional(Schema.Unknown),
}) { }

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
    message: Schema.String,
    cause: Schema.Unknown,
}) { }

export class StorageError extends Schema.TaggedError<StorageError>()("StorageError", {
    message: Schema.String,
    cause: Schema.Unknown,
}) { }

export class QueueError extends Schema.TaggedError<QueueError>()("QueueError", {
    message: Schema.String,
    cause: Schema.Unknown,
}) { }

export class PdfRenderError extends Schema.TaggedError<PdfRenderError>()("PdfRenderError", {
    message: Schema.String,
    cause: Schema.Unknown,
}) { }

export class CallbackError extends Schema.TaggedError<CallbackError>()("CallbackError", {
    message: Schema.String,
    cause: Schema.Unknown,
}) { }

export class ConfigurationError extends Schema.TaggedError<ConfigurationError>()("ConfigurationError", {
    message: Schema.String,
}) { }
