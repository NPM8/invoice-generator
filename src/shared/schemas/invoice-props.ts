import { Schema } from "effect"
import { VatSummaryEntry } from "./invoice.ts"

// All data needed to render an invoice PDF via a template component
export class InvoiceProps extends Schema.Class<InvoiceProps>("InvoiceProps")({
  invoiceNumber: Schema.String,
  issueDate: Schema.String,
  dueDate: Schema.String,

  // Seller info
  seller: Schema.Struct({
    name: Schema.String,
    address: Schema.String,
    taxId: Schema.optional(Schema.String),
    countryCode: Schema.String,
  }),

  // Buyer info
  buyer: Schema.Struct({
    name: Schema.String,
    address: Schema.String,
    taxId: Schema.optional(Schema.String),
    countryCode: Schema.String,
    email: Schema.optional(Schema.String),
  }),

  // Line items
  items: Schema.Array(
    Schema.Struct({
      position: Schema.Number,
      description: Schema.String,
      quantity: Schema.Number,
      unit: Schema.String,
      unitPrice: Schema.Number,
      discountPercent: Schema.Number,
      vatRate: Schema.Number,
      netAmount: Schema.Number,
      vatAmount: Schema.Number,
      grossAmount: Schema.Number,
    })
  ),

  // Financials
  currency: Schema.String,
  subtotal: Schema.Number,
  totalVat: Schema.Number,
  total: Schema.Number,
  vatSummary: Schema.Array(VatSummaryEntry),
  isReverseCharge: Schema.Boolean,

  // Payment details
  payment: Schema.optionalWith(
    Schema.Struct({
      bankName: Schema.optional(Schema.String),
      iban: Schema.optional(Schema.String),
      swift: Schema.optional(Schema.String),
      accountNumber: Schema.optional(Schema.String),
    }),
    { as: "Option" }
  ),

  // Footer
  notes: Schema.optionalWith(Schema.String, { as: "Option" }),
  terms: Schema.optionalWith(Schema.String, { as: "Option" }),

  // Branding
  logoUrl: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}
