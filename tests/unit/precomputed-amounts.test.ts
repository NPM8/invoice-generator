import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { CreateInvoice } from "../../src/shared/schemas/invoice.js"
import { computeInvoiceAmounts } from "../../src/shared/services/invoice.js"

const decode = Schema.decodeUnknownSync(CreateInvoice)

describe("computeInvoiceAmounts with caller-supplied amounts", () => {
    it("uses line amounts verbatim even when they differ from quantity x price", () => {
        const input = decode({
            buyerName: "B", buyerCountryCode: "PL", currency: "PLN", issueDate: "2026-10-30", dueDate: "2026-11-13",
            items: [{ position: 1, description: "Desk", quantity: 3, unitPrice: 33.33, vatRate: 23, amounts: { net: 100, vat: 23, gross: 123 } }],
        })
        const result = computeInvoiceAmounts(input, "PL")
        expect(result.lines[0]!.netAmount).toBe(100)
        expect(result.lines[0]!.vatAmount).toBe(23)
        expect(result.lines[0]!.grossAmount).toBe(123)
        expect(result.totals).toEqual({ subtotal: 100, totalVat: 23, total: 123 })
    })

    it("sums totals from the given amounts across lines", () => {
        const input = decode({
            buyerName: "B", buyerCountryCode: "PL", currency: "PLN", issueDate: "2026-10-30", dueDate: "2026-11-13",
            items: [
                { position: 1, description: "Desk", quantity: 1, unitPrice: 0, vatRate: 23, amounts: { net: 813.01, vat: 186.99, gross: 1000 } },
                { position: 2, description: "Room", quantity: 1, unitPrice: 0, vatRate: 23, amounts: { net: 40.65, vat: 9.35, gross: 50 } },
                { position: 3, description: "Mail", quantity: 1, unitPrice: 0, vatRate: 0, vatType: "exempt", vatLabel: "zw", amounts: { net: 30, vat: 0, gross: 30 } },
            ],
        })
        const result = computeInvoiceAmounts(input, "PL")
        expect(result.totals).toEqual({ subtotal: 883.66, totalVat: 196.34, total: 1080 })
    })

    it("groups the VAT summary by rate + type + label", () => {
        const input = decode({
            buyerName: "B", buyerCountryCode: "PL", currency: "PLN", issueDate: "2026-10-30", dueDate: "2026-11-13",
            items: [
                { position: 1, description: "Desk", quantity: 1, unitPrice: 0, vatRate: 23, amounts: { net: 100, vat: 23, gross: 123 } },
                { position: 2, description: "Room", quantity: 1, unitPrice: 0, vatRate: 23, amounts: { net: 200, vat: 46, gross: 246 } },
                { position: 3, description: "Mail", quantity: 1, unitPrice: 0, vatRate: 0, vatType: "exempt", vatLabel: "zw", amounts: { net: 30, vat: 0, gross: 30 } },
                { position: 4, description: "Abroad", quantity: 1, unitPrice: 0, vatRate: 0, vatType: "zero_rated", vatLabel: "np", amounts: { net: 70, vat: 0, gross: 70 } },
            ],
        })
        const result = computeInvoiceAmounts(input, "PL")
        expect(result.vatSummary).toEqual([
            { vatRate: 0, vatType: "exempt", netAmount: 30, vatAmount: 0, grossAmount: 30, vatLabel: "zw" },
            { vatRate: 0, vatType: "zero_rated", netAmount: 70, vatAmount: 0, grossAmount: 70, vatLabel: "np" },
            { vatRate: 23, vatType: "standard", netAmount: 300, vatAmount: 69, grossAmount: 369 },
        ])
    })

    it("does not auto-detect reverse charge when the caller supplies amounts", () => {
        // Cross-border B2B with a buyer VAT id would auto-detect reverse charge; the caller charged VAT.
        const input = decode({
            buyerName: "B", buyerCountryCode: "DE", buyerTaxId: "DE123", currency: "EUR", issueDate: "2026-10-30", dueDate: "2026-11-13",
            items: [{ position: 1, description: "Desk", quantity: 1, unitPrice: 0, vatRate: 23, amounts: { net: 100, vat: 23, gross: 123 } }],
        })
        const result = computeInvoiceAmounts(input, "PL")
        expect(result.isReverseCharge).toBe(false)
        expect(result.lines[0]!.vatType).toBe("standard")
    })

    it("flags reverse charge when the caller marks a line reverse_charge", () => {
        const input = decode({
            buyerName: "B", buyerCountryCode: "DE", buyerTaxId: "DE123", currency: "EUR", issueDate: "2026-10-30", dueDate: "2026-11-13",
            items: [{ position: 1, description: "Desk", quantity: 1, unitPrice: 0, vatRate: 0, vatType: "reverse_charge", vatLabel: "np", amounts: { net: 100, vat: 0, gross: 100 } }],
        })
        const result = computeInvoiceAmounts(input, "PL")
        expect(result.isReverseCharge).toBe(true)
    })
})

describe("computeInvoiceAmounts without amounts (existing behaviour)", () => {
    it("calculates line VAT and groups the summary by rate only", () => {
        const input = decode({
            buyerName: "B", buyerCountryCode: "SK", currency: "EUR", issueDate: "2026-10-30", dueDate: "2026-11-13",
            items: [
                { position: 1, description: "A", quantity: 10, unitPrice: 100, vatRate: 20 },
                { position: 2, description: "B", quantity: 1, unitPrice: 200, vatRate: 20 },
            ],
        })
        const result = computeInvoiceAmounts(input, "SK")
        expect(result.totals).toEqual({ subtotal: 1200, totalVat: 240, total: 1440 })
        expect(result.vatSummary).toEqual([
            { vatRate: 20, vatType: "standard", netAmount: 1200, vatAmount: 240, grossAmount: 1440 },
        ])
    })

    it("auto-detects cross-border reverse charge from the seller country", () => {
        const input = decode({
            buyerName: "B", buyerCountryCode: "DE", buyerTaxId: "DE123", currency: "EUR", issueDate: "2026-10-30", dueDate: "2026-11-13",
            items: [{ position: 1, description: "A", quantity: 1, unitPrice: 100, vatRate: 20 }],
        })
        const result = computeInvoiceAmounts(input, "SK")
        expect(result.isReverseCharge).toBe(true)
        expect(result.totals).toEqual({ subtotal: 100, totalVat: 0, total: 100 })
    })
})
