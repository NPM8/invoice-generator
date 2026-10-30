import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { CreateInvoice } from "../../src/shared/schemas/invoice.js"

const decode = Schema.decodeUnknownSync(CreateInvoice)

const base = {
    buyerName: "Kowalski Sp. z o.o.",
    buyerCountryCode: "PL",
    currency: "PLN",
    issueDate: "2026-10-30",
    dueDate: "2026-11-13",
    items: [{ position: 1, description: "Hot desk", quantity: 1, unitPrice: 100, vatRate: 23 }],
}

describe("CreateInvoice platform fields", () => {
    it("accepts a legacy payload with none of the new fields", () => {
        const result = decode(base)
        expect(result.externalRef).toBeUndefined()
        expect(result.seller).toBeUndefined()
        expect(result.locale).toBeUndefined()
        expect(result.items[0]!.amounts).toBeUndefined()
    })

    it("accepts a full platform payload", () => {
        const result = decode({
            ...base,
            externalRef: "booking-42",
            invoiceNumber: "FV/2026/10/0042",
            templateName: "brand",
            locale: "pl",
            paymentUrl: "https://pay.example.com/i/abc",
            legalNotes: ["Zwolnienie z VAT"],
            seller: { name: "Operator", address: "Łódź", countryCode: "PL", taxId: "PL7251234567", email: "a@b.pl", bankIban: "PL61" },
            branding: { logoUrl: "https://cdn.example.com/logo.png", accentColor: "#0F766E", displayName: "Operator" },
            items: [{ position: 1, description: "Desk", quantity: 1, unitPrice: 100, vatRate: 23, vatLabel: "23%", amounts: { net: 100, vat: 23, gross: 123 } }],
        })
        expect(result.externalRef).toBe("booking-42")
        expect(result.invoiceNumber).toBe("FV/2026/10/0042")
        expect(result.seller?.name).toBe("Operator")
        expect(result.branding?.accentColor).toBe("#0F766E")
        expect(result.items[0]!.amounts?.gross).toBe(123)
    })

    it("accepts PNG and JPEG data URIs as logo", () => {
        expect(decode({ ...base, branding: { logoUrl: "data:image/png;base64,iVBORw0KGgo=" } }).branding?.logoUrl).toStartWith("data:image/png")
        expect(decode({ ...base, branding: { logoUrl: "data:image/jpeg;base64,/9j/4AAQ" } }).branding?.logoUrl).toStartWith("data:image/jpeg")
    })

    it("rejects an http (non-https) logo URL", () => {
        expect(() => decode({ ...base, branding: { logoUrl: "http://cdn.example.com/logo.png" } })).toThrow()
    })

    it("rejects an SVG data URI logo", () => {
        expect(() => decode({ ...base, branding: { logoUrl: "data:image/svg+xml;base64,PHN2Zz4=" } })).toThrow()
    })

    it("rejects a logo longer than 2,000,000 characters", () => {
        const logoUrl = `data:image/png;base64,${"A".repeat(2_000_000)}`
        expect(() => decode({ ...base, branding: { logoUrl } })).toThrow()
    })

    it("rejects an invalid accent colour", () => {
        expect(() => decode({ ...base, branding: { accentColor: "teal" } })).toThrow()
        expect(() => decode({ ...base, branding: { accentColor: "#0f766" } })).toThrow()
    })

    it("rejects an invoiceNumber containing control characters", () => {
        expect(() => decode({ ...base, invoiceNumber: "INV\n0001" })).toThrow()
        expect(() => decode({ ...base, invoiceNumber: "INV\u00000001" })).toThrow()
    })

    it("rejects an invoiceNumber longer than 64 characters", () => {
        expect(() => decode({ ...base, invoiceNumber: "X".repeat(65) })).toThrow()
    })

    it("rejects an empty or over-long externalRef", () => {
        expect(() => decode({ ...base, externalRef: "" })).toThrow()
        expect(() => decode({ ...base, externalRef: "x".repeat(201) })).toThrow()
    })

    it("rejects an unsupported locale", () => {
        expect(() => decode({ ...base, locale: "fr" })).toThrow()
    })

    it("rejects an unknown templateName", () => {
        expect(() => decode({ ...base, templateName: "does-not-exist" })).toThrow()
    })

    it("rejects more than 10 legal notes", () => {
        expect(() => decode({ ...base, legalNotes: Array.from({ length: 11 }, () => "note") })).toThrow()
    })

    it("rejects a seller without address", () => {
        expect(() => decode({ ...base, seller: { name: "Operator", countryCode: "PL" } })).toThrow()
    })

    it("rejects line amounts missing gross", () => {
        expect(() => decode({ ...base, items: [{ ...base.items[0], amounts: { net: 100, vat: 23 } }] })).toThrow()
    })
})
