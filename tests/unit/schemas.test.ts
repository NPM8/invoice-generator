import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { CreateInvoice } from "../../src/shared/schemas/invoice.js"

describe("Schemas", () => {
    it("validates valid invoice creation payload", () => {
        const payload = {
            buyerName: "Acme Corp",
            buyerCountryCode: "US",
            currency: "USD",
            issueDate: "2024-01-01",
            dueDate: "2024-01-31",
            items: [
                {
                    position: 1,
                    description: "Consulting",
                    quantity: 10,
                    unitPrice: 150,
                    vatRate: 0,
                }
            ]
        }

        const decode = Schema.decodeUnknownSync(CreateInvoice)
        const result = decode(payload)

        expect(result.buyerName).toBe("Acme Corp")
        expect(result.items.length).toBe(1)
        expect(result.items[0].unit).toBe("pcs") // Default unit applied
    })

    it("fails on invalid invoice creation payload", () => {
        const payload = {
            buyerName: "Acme Corp",
            // missing country code
            // missing currency
            issueDate: "2024-01-01",
            dueDate: "2024-01-31",
            items: [] // empty array not allowed since it's NonEmptyArray
        }

        const decode = Schema.decodeUnknownSync(CreateInvoice)
        let err = null
        try {
            decode(payload)
        } catch (e) {
            err = e
        }

        expect(err).not.toBeNull()
    })
})
