import { describe, it, expect } from "bun:test"

// Since the invoice number generation is done via Postgres RPC, the unit test
// will just verify the expected string concatenation format as a sanity check.

describe("Invoice Number Formatting", () => {
    it("formats the sequence properly in JS equivalent code", () => {
        const prefix = "INV"
        const currentNumber = 1
        const pad = (num: number) => num.toString().padStart(6, '0')
        const invoiceNumber = `${prefix}-${pad(currentNumber)}`

        expect(invoiceNumber).toBe("INV-000001")
    })

    it("handles larger numbers", () => {
        const prefix = "US"
        const currentNumber = 9999
        const pad = (num: number) => num.toString().padStart(6, '0')
        const invoiceNumber = `${prefix}-${pad(currentNumber)}`

        expect(invoiceNumber).toBe("US-009999")
    })
})
