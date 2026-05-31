import { Schema } from "effect"
import { UUID, TemplateStatus } from "./common.ts"

export class InvoiceTemplate extends Schema.Class<InvoiceTemplate>("InvoiceTemplate")({
  id: UUID,
  orgId: UUID,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  version: Schema.Number,
  isDefault: Schema.Boolean,
  status: TemplateStatus,
  componentCode: Schema.String,
  compiledCode: Schema.NullOr(Schema.String),
  propsSchema: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class CreateTemplate extends Schema.Class<CreateTemplate>("CreateTemplate")({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  componentCode: Schema.String.pipe(Schema.minLength(1)),
  propsSchema: Schema.optional(Schema.Unknown),
}) {}

export class UpdateTemplate extends Schema.Class<UpdateTemplate>("UpdateTemplate")({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.optional(TemplateStatus),
  componentCode: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  propsSchema: Schema.optional(Schema.NullOr(Schema.Unknown)),
}) {}
