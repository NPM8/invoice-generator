import { Schema } from "effect"
import {
  UUID,
  CountryCode,
  CurrencyCode,
  TaxIdType,
  InvoiceStatus,
  CallbackStatus,
  VatType,
  PaymentMethod,
  PaymentStatus,
  Email,
  Url,
  Money,
  PositiveInt,
  NonNegative,
  Percentage,
  Locale,
  TemplateName,
  SingleLineText,
  HexColor,
  LogoUrl,
} from "./common.ts"

// --- VAT Summary ---

export const VatSummaryEntry = Schema.Struct({
  vatRate: Schema.Number,
  vatType: VatType,
  netAmount: Schema.Number,
  vatAmount: Schema.Number,
  grossAmount: Schema.Number,
  // Caller-supplied label (e.g. "zw", "np") when the lines carried one
  vatLabel: Schema.optional(Schema.NullOr(Schema.String)),
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
  vatLabel: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.String,
}) {}

// Exact line amounts computed by the caller (used verbatim instead of calculating)
export const LineAmounts = Schema.Struct({
  net: Money,
  vat: Money,
  gross: Money,
})
export type LineAmounts = typeof LineAmounts.Type

export class CreateInvoiceItem extends Schema.Class<CreateInvoiceItem>("CreateInvoiceItem")({
  position: PositiveInt,
  description: Schema.String.pipe(Schema.minLength(1)),
  quantity: NonNegative,
  unit: Schema.optionalWith(Schema.String, { default: () => "pcs" }),
  unitPrice: Money,
  discountPercent: Schema.optionalWith(Percentage, { default: () => 0 }),
  vatRate: Percentage,
  vatType: Schema.optionalWith(VatType, { default: () => "standard" as const }),
  amounts: Schema.optional(LineAmounts),
  vatLabel: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))),
}) {}

// Seller supplied per invoice (platform mode: one API key invoicing for many sellers)
export const SellerOverride = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
  address: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(500)),
  countryCode: CountryCode,
  taxId: Schema.optional(Schema.String),
  taxIdType: Schema.optional(TaxIdType),
  companyRegistrationNumber: Schema.optional(Schema.String),
  localTaxId: Schema.optional(Schema.String),
  registrationDetails: Schema.optional(Schema.String),
  email: Schema.optional(Email),
  bankName: Schema.optional(Schema.String),
  bankIban: Schema.optional(Schema.String),
  bankSwift: Schema.optional(Schema.String),
  bankAccountNumber: Schema.optional(Schema.String),
})
export type SellerOverride = typeof SellerOverride.Type

export const Branding = Schema.Struct({
  logoUrl: Schema.optional(LogoUrl),
  accentColor: Schema.optional(HexColor),
  displayName: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200))),
})
export type Branding = typeof Branding.Type

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
  sellerCompanyRegistrationNumber: Schema.NullOr(Schema.String),
  sellerLocalTaxId: Schema.NullOr(Schema.String),
  sellerRegistrationDetails: Schema.NullOr(Schema.String),
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
  pdfGeneratedAt: Schema.NullOr(Schema.String),
  // Payment
  paymentStatus: PaymentStatus,
  paymentMethod: Schema.NullOr(PaymentMethod),
  paidAt: Schema.NullOr(Schema.String),
  cardLast4: Schema.NullOr(Schema.String),
  // Platform mode (all optional; null/absent for invoices created without them)
  externalRef: Schema.optional(Schema.NullOr(Schema.String)),
  templateName: Schema.optional(Schema.NullOr(Schema.String)),
  locale: Schema.optional(Schema.NullOr(Locale)),
  sellerOverride: Schema.optional(Schema.Boolean),
  sellerEmail: Schema.optional(Schema.NullOr(Schema.String)),
  sellerBankName: Schema.optional(Schema.NullOr(Schema.String)),
  sellerBankIban: Schema.optional(Schema.NullOr(Schema.String)),
  sellerBankSwift: Schema.optional(Schema.NullOr(Schema.String)),
  sellerBankAccountNumber: Schema.optional(Schema.NullOr(Schema.String)),
  logoUrl: Schema.optional(Schema.NullOr(Schema.String)),
  accentColor: Schema.optional(Schema.NullOr(Schema.String)),
  brandDisplayName: Schema.optional(Schema.NullOr(Schema.String)),
  paymentUrl: Schema.optional(Schema.NullOr(Schema.String)),
  legalNotes: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  // Callback
  callbackUrl: Schema.NullOr(Url),
  callbackStatus: CallbackStatus,
  callbackAttempts: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  callbackLastAttemptAt: Schema.NullOr(Schema.String),
  // Metadata
  notes: Schema.NullOr(Schema.String),
  terms: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Unknown),
  // Timestamps
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class CreateInvoice extends Schema.Class<CreateInvoice>("CreateInvoice")({
  templateId: Schema.optional(UUID),
  // Bundled template by name; no invoice_templates row needed. Wins over templateId.
  templateName: Schema.optional(TemplateName),
  // Idempotency key: same (org, externalRef) returns the existing invoice
  externalRef: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200))),
  // Used verbatim instead of generating the org's next number
  invoiceNumber: Schema.optional(SingleLineText.pipe(Schema.minLength(1), Schema.maxLength(64))),
  // Seller snapshot source instead of the API key's organization
  seller: Schema.optional(SellerOverride),
  branding: Schema.optional(Branding),
  locale: Schema.optional(Locale),
  paymentUrl: Schema.optional(Url),
  legalNotes: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(1000))).pipe(Schema.maxItems(10))
  ),
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
  // Payment (e.g. already paid by card at checkout in the calling app)
  paymentStatus: Schema.optionalWith(PaymentStatus, { default: () => "unpaid" as const }),
  paymentMethod: Schema.optional(PaymentMethod),
  paidAt: Schema.optional(Schema.String),
  cardLast4: Schema.optional(Schema.String.pipe(Schema.pattern(/^[0-9]{4}$/))),
  // Optional
  callbackUrl: Schema.optional(Url),
  notes: Schema.optional(Schema.String),
  terms: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Unknown),
}) {}
