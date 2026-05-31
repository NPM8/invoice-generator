import { Schema } from "effect"

// --- Branded types ---

// Branded UUID type
export const UUID = Schema.UUID.pipe(Schema.brand("UUID"))
export type UUID = typeof UUID.Type

// Country code (ISO 3166-1 alpha-2)
export const CountryCode = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{2}$/),
  Schema.brand("CountryCode")
)
export type CountryCode = typeof CountryCode.Type

// Currency code (ISO 4217)
export const CurrencyCode = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{3}$/),
  Schema.brand("CurrencyCode")
)
export type CurrencyCode = typeof CurrencyCode.Type

// --- Enums ---

// Tax ID type enum
export const TaxIdType = Schema.Literal("eu_vat", "us_ein", "gb_vat", "au_abn", "other")
export type TaxIdType = typeof TaxIdType.Type

// Invoice status
export const InvoiceStatus = Schema.Literal("pending", "processing", "completed", "failed")
export type InvoiceStatus = typeof InvoiceStatus.Type

// API key status
export const ApiKeyStatus = Schema.Literal("active", "revoked", "expired")
export type ApiKeyStatus = typeof ApiKeyStatus.Type

// Template status
export const TemplateStatus = Schema.Literal("active", "archived")
export type TemplateStatus = typeof TemplateStatus.Type

// Job status
export const JobStatus = Schema.Literal("queued", "processing", "completed", "failed", "retrying")
export type JobStatus = typeof JobStatus.Type

// Callback status
export const CallbackStatus = Schema.Literal("none", "pending", "delivered", "failed")
export type CallbackStatus = typeof CallbackStatus.Type

// VAT type
export const VatType = Schema.Literal("standard", "reverse_charge", "zero_rated", "exempt")
export type VatType = typeof VatType.Type

// How the invoice was/should be paid
export const PaymentMethod = Schema.Literal("card", "bank_transfer", "cash", "other")
export type PaymentMethod = typeof PaymentMethod.Type

// Whether the invoice has been paid
export const PaymentStatus = Schema.Literal("paid", "unpaid")
export type PaymentStatus = typeof PaymentStatus.Type

// --- Numeric helpers ---

// Money (finite number, 2 decimal places conceptually)
export const Money = Schema.Number.pipe(Schema.finite())
export type Money = typeof Money.Type

// Positive integer
export const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.positive())
export type PositiveInt = typeof PositiveInt.Type

// Non-negative number
export const NonNegative = Schema.Number.pipe(Schema.finite(), Schema.nonNegative())
export type NonNegative = typeof NonNegative.Type

// Percentage (0-100)
export const Percentage = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100)
)
export type Percentage = typeof Percentage.Type

// --- String helpers ---

// Email
export const Email = Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
export type Email = typeof Email.Type

// URL
export const Url = Schema.String.pipe(Schema.pattern(/^https?:\/\/.+/))
export type Url = typeof Url.Type

// --- Pagination ---

export const PaginationParams = Schema.Struct({
  page: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.positive(), Schema.lessThanOrEqualTo(100)),
    { default: () => 20 }
  ),
})
export type PaginationParams = typeof PaginationParams.Type

// Paginated response wrapper (generic)
export const PaginatedResponse = <A, I, R>(itemSchema: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    data: Schema.Array(itemSchema),
    total: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    page: Schema.Number.pipe(Schema.int(), Schema.positive()),
    limit: Schema.Number.pipe(Schema.int(), Schema.positive()),
    totalPages: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  })
