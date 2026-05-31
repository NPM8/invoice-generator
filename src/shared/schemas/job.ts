import { Schema } from "effect"
import { UUID, JobStatus, PositiveInt } from "./common.ts"

export class Job extends Schema.Class<Job>("Job")({
  id: UUID,
  invoiceId: UUID,
  queueName: Schema.String,
  status: JobStatus,
  attempts: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxAttempts: PositiveInt,
  lastError: Schema.NullOr(Schema.String),
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  failedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class CreateJob extends Schema.Class<CreateJob>("CreateJob")({
  invoiceId: UUID,
  queueName: Schema.String.pipe(Schema.minLength(1)),
  maxAttempts: Schema.optionalWith(PositiveInt, { default: () => 5 as PositiveInt }),
}) {}
