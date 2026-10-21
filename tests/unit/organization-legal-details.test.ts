import { expect, test } from "bun:test"
import { Schema } from "effect"
import { CreateOrganization, UpdateOrganization } from "../../src/shared/schemas/organization.js"

test("organization API retains seller registration, local tax and registry details", () => {
    const details = { companyRegistrationNumber: "50969684", localTaxId: "2120546571", registrationDetails: "Mestský súd Bratislava III\nOddiel: Sro, vložka číslo: 120761/B" }
    const created = Schema.decodeUnknownSync(CreateOrganization)({ name: "Bezbarfit", legalName: "Bezbarfit s. r. o.", countryCode: "SK", ...details })
    const updated = Schema.decodeUnknownSync(UpdateOrganization)(details)
    for (const field of Object.keys(details) as Array<keyof typeof details>) {
        expect(created[field]).toBe(details[field])
        expect(updated[field]).toBe(details[field])
    }
})

test("seller legal details can be cleared without changing invoice numbering", () => {
    const updated = Schema.decodeUnknownSync(UpdateOrganization)({ companyRegistrationNumber: null, localTaxId: null, registrationDetails: null })
    expect(updated.companyRegistrationNumber).toBeNull()
    expect(updated.localTaxId).toBeNull()
    expect(updated.registrationDetails).toBeNull()
    expect(updated.invoicePrefix).toBeUndefined()
    expect((updated as any).nextInvoiceNumber).toBeUndefined()
})
