import { describe, it, expect } from "bun:test"
import { calculateLineVat, computeVatSummary, computeInvoiceTotals, determineReverseCharge } from "../../src/shared/services/vat.js"

describe("VAT Calculation", () => {
    it("computes standard VAT correctly", () => {
        const res = calculateLineVat(2, 50, 0, 20, "standard")
        expect(res.netAmount).toBe(100)
        expect(res.vatAmount).toBe(20)
        expect(res.grossAmount).toBe(120)
    })

    it("handles standard VAT with discount correctly", () => {
        const res = calculateLineVat(2, 50, 10, 20, "standard")
        // Total 100, Discount 10% = 10, Net 90, VAT 20% of 90 = 18, Gross 108
        expect(res.netAmount).toBe(90)
        expect(res.vatAmount).toBe(18)
        expect(res.grossAmount).toBe(108)
    })

    it("handles zero-rated VAT correctly", () => {
        const res = calculateLineVat(1, 100, 0, 0, "zero_rated")
        expect(res.netAmount).toBe(100)
        expect(res.vatAmount).toBe(0)
        expect(res.grossAmount).toBe(100)
    })

    it("handles reverse charge correctly", () => {
        const res = calculateLineVat(1, 100, 0, 20, "reverse_charge")
        expect(res.netAmount).toBe(100)
        expect(res.vatAmount).toBe(0) // VAT is accounted by customer
        expect(res.grossAmount).toBe(100)
    })

    it("computes summary grouped by rate correctly", () => {
        const lines = [
            { netAmount: 100, vatAmount: 20, grossAmount: 120, vatRate: 20, vatType: "standard" as const },
            { netAmount: 50, vatAmount: 10, grossAmount: 60, vatRate: 20, vatType: "standard" as const },
            { netAmount: 200, vatAmount: 10, grossAmount: 210, vatRate: 5, vatType: "standard" as const },
        ]

        const summary = computeVatSummary(lines)

        expect(summary.length).toBe(2)
        const rate5 = summary.find(s => s.vatRate === 5)!
        expect(rate5.netAmount).toBe(200)
        expect(rate5.vatAmount).toBe(10)
        expect(rate5.vatType).toBe("standard")

        const rate20 = summary.find(s => s.vatRate === 20)!
        expect(rate20.netAmount).toBe(150)
        expect(rate20.vatAmount).toBe(30)
    })

    it("determines reverse charge heuristically", () => {
        // Domestic
        expect(determineReverseCharge("GB", "GB", "GB123456789")).toBe(false)
        expect(determineReverseCharge("US", "US", null)).toBe(false)

        // International B2C (no VAT ID)
        expect(determineReverseCharge("GB", "FR", null)).toBe(false)

        // International B2B
        expect(determineReverseCharge("GB", "FR", "FR12345")).toBe(true)
    })

    it("sums invoice totals correctly", () => {
        const lines = [
            { netAmount: 100, vatAmount: 20, grossAmount: 120 },
            { netAmount: 50.55, vatAmount: 10.11, grossAmount: 60.66 },
        ]
        const totals = computeInvoiceTotals(lines)
        expect(totals.subtotal).toBe(150.55)
        expect(totals.totalVat).toBe(30.11)
        expect(totals.total).toBe(180.66)
    })
})
