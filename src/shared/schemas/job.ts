import { Schema } from "effect"
import { UUID, JobStatus, PositiveInt } from "./common.ts"

export class Job extends Schema.Class<Job>("Job")({
  id: UUID,
  invoiceId: UUID,
  queueName: Schema.String,
  bullmqJobId: Schema.NullOr(Schema.String),
  status: JobStatus,
  attempts: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxAttempts: PositiveInt,
  lastError: Schema.NullOr(Schema.String),
  startedAt: Schema.NullOr(Schema.DateFromString),
  completedAt: Schema.NullOr(Schema.DateFromString),
  failedAt: Schema.NullOr(Schema.DateFromString),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class CreateJob extends Schema.Class<CreateJob>("CreateJob")({
  invoiceId: UUID,
  queueName: Schema.String.pipe(Schema.minLength(1)),
  bullmqJobId: Schema.optional(Schema.String),
  maxAttempts: Schema.optionalWith(PositiveInt, { default: () => 5 as PositiveInt }),
}) {}
