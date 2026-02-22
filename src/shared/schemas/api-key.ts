import { Schema } from "effect"
import { UUID, ApiKeyStatus, PositiveInt } from "./common.ts"

export class ApiKey extends Schema.Class<ApiKey>("ApiKey")({
  id: UUID,
  orgId: UUID,
  keyPrefix: Schema.String,
  keyHash: Schema.String,
  name: Schema.String,
  status: ApiKeyStatus,
  scopes: Schema.Array(Schema.String),
  rateLimit: PositiveInt,
  lastUsedAt: Schema.NullOr(Schema.DateFromString),
  expiresAt: Schema.NullOr(Schema.DateFromString),
  createdAt: Schema.DateFromString,
  revokedAt: Schema.NullOr(Schema.DateFromString),
  createdBy: Schema.NullOr(Schema.String),
}) {}

export class CreateApiKey extends Schema.Class<CreateApiKey>("CreateApiKey")({
  orgId: UUID,
  name: Schema.String.pipe(Schema.minLength(1)),
  scopes: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  expiresAt: Schema.optional(Schema.DateFromString),
}) {}

// Public response shape - NEVER expose keyHash
export class ApiKeyResponse extends Schema.Class<ApiKeyResponse>("ApiKeyResponse")({
  id: UUID,
  orgId: UUID,
  keyPrefix: Schema.String,
  name: Schema.String,
  status: ApiKeyStatus,
  scopes: Schema.Array(Schema.String),
  rateLimit: PositiveInt,
  lastUsedAt: Schema.NullOr(Schema.DateFromString),
  expiresAt: Schema.NullOr(Schema.DateFromString),
  createdAt: Schema.DateFromString,
}) {}

// Returned only once on creation - includes the raw key
export class ApiKeyWithSecret extends Schema.Class<ApiKeyWithSecret>("ApiKeyWithSecret")({
  id: UUID,
  orgId: UUID,
  keyPrefix: Schema.String,
  name: Schema.String,
  status: ApiKeyStatus,
  scopes: Schema.Array(Schema.String),
  rateLimit: PositiveInt,
  lastUsedAt: Schema.NullOr(Schema.DateFromString),
  expiresAt: Schema.NullOr(Schema.DateFromString),
  createdAt: Schema.DateFromString,
  key: Schema.String,
}) {}
