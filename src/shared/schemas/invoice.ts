import { Schema } from "effect"
import {
  UUID,
  CountryCode,
  CurrencyCode,
  TaxIdType,
  InvoiceStatus,
  CallbackStatus,
  VatType,
  Email,
  Url,
  Money,
  PositiveInt,
  NonNegative,
  Percentage,
} from "./common.ts"

// --- VAT Summary ---

export const VatSummaryEntry = Schema.Struct({
  vatRate: Schema.Number,
  vatType: VatType,
  netAmount: Schema.Number,
  vatAmount: Schema.Number,
  grossAmount: Schema.Number,
})
export type VatSummaryEntry = typeof VatSummaryEntry.Type

// --- Invoice Item ---

export class InvoiceItem extends Schema.Class<InvoiceItem>("InvoiceItem")({
  id: UUID,
  invoiceId: UUID,
  position: PositiveInt,
  description: Schema.String,
  quantity: NonNegative,
  unit: Schema.String,
  unitPrice: Money,
  discountPercent: Percentage,
  vatRate: Percentage,
  vatAmount: Money,
  netAmount: Money,
  grossAmount: Money,
  createdAt: Schema.DateFromString,
}) {}

export class CreateInvoiceItem extends Schema.Class<CreateInvoiceItem>("CreateInvoiceItem")({
  position: PositiveInt,
  description: Schema.String.pipe(Schema.minLength(1)),
  quantity: NonNegative,
  unit: Schema.optionalWith(Schema.String, { default: () => "pcs" }),
  unitPrice: Money,
  discountPercent: Schema.optionalWith(Percentage, { default: () => 0 }),
  vatRate: Percentage,
  vatType: Schema.optionalWith(VatType, { default: () => "standard" as const }),
}) {}

// --- Invoice ---

export class Invoice extends Schema.Class<Invoice>("Invoice")({
  id: UUID,
  orgId: UUID,
  invoiceNumber: Schema.String,
  templateId: Schema.NullOr(UUID),
  status: InvoiceStatus,
  // Seller info (snapshot from org at time of creation)
  sellerName: Schema.String,
  sellerAddress: Schema.NullOr(Schema.String),
  sellerTaxId: Schema.NullOr(Schema.String),
  sellerTaxIdType: Schema.NullOr(TaxIdType),
  sellerCountryCode: CountryCode,
  // Buyer info
  buyerName: Schema.String,
  buyerAddress: Schema.NullOr(Schema.String),
  buyerTaxId: Schema.NullOr(Schema.String),
  buyerTaxIdType: Schema.NullOr(TaxIdType),
  buyerCountryCode: CountryCode,
  buyerEmail: Schema.NullOr(Email),
  // Financial
  currency: CurrencyCode,
  subtotal: Money,
  totalVat: Money,
  total: Money,
  vatSummary: Schema.Array(VatSummaryEntry),
  isReverseCharge: Schema.Boolean,
  // Dates
  issueDate: Schema.String,
  dueDate: Schema.String,
  // PDF
  pdfUrl: Schema.NullOr(Schema.String),
  pdfGeneratedAt: Schema.NullOr(Schema.DateFromString),
  // Callback
  callbackUrl: Schema.NullOr(Url),
  callbackStatus: CallbackStatus,
  callbackAttempts: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  callbackLastAttemptAt: Schema.NullOr(Schema.DateFromString),
  // Metadata
  notes: Schema.NullOr(Schema.String),
  terms: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Unknown),
  // Timestamps
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class CreateInvoice extends Schema.Class<CreateInvoice>("CreateInvoice")({
  templateId: Schema.optional(UUID),
  // Buyer info
  buyerName: Schema.String.pipe(Schema.minLength(1)),
  buyerAddress: Schema.optional(Schema.String),
  buyerTaxId: Schema.optional(Schema.String),
  buyerTaxIdType: Schema.optional(TaxIdType),
  buyerCountryCode: CountryCode,
  buyerEmail: Schema.optional(Email),
  // Financial
  currency: CurrencyCode,
  // Items
  items: Schema.NonEmptyArray(CreateInvoiceItem),
  // Dates
  issueDate: Schema.String,
  dueDate: Schema.String,
  // Optional
  callbackUrl: Schema.optional(Url),
  notes: Schema.optional(Schema.String),
  terms: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Unknown),
}) {}
