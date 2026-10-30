import { describe, it, expect } from "bun:test"
import React from "react"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import Brand from "../../src/templates/components/brand.js"
import { resolveTemplateComponent } from "../../src/templates/registry.js"
import { labelsFor, makeFormatters } from "../../src/templates/i18n.js"
import { buildInvoiceProps } from "../../src/invoice-worker/processors/pdf-generation.js"
import type { InvoicePropsType } from "../../src/templates/types.js"

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // "%PDF"

const render = async (props: InvoicePropsType) => {
    const element = React.createElement(Brand, props) as unknown as React.ReactElement<DocumentProps>
    return new Uint8Array(await renderToBuffer(element))
}

const invoice = (overrides: Record<string, unknown> = {}) => ({
    id: "11111111-1111-4111-8111-111111111111",
    orgId: "22222222-2222-4222-8222-222222222222",
    invoiceNumber: "FV/2026/10/0042",
    templateId: null,
    status: "processing",
    sellerName: "Przestrzeń Łódź Sp. z o.o.",
    sellerAddress: "ul. Piotrkowska 120, 90-006 Łódź",
    sellerTaxId: "PL7251234567",
    sellerCompanyRegistrationNumber: "0000123456",
    sellerLocalTaxId: null,
    sellerRegistrationDetails: null,
    sellerTaxIdType: "eu_vat",
    sellerCountryCode: "PL",
    buyerName: "Žluťoučký kůň s.r.o.",
    buyerAddress: "Václavské náměstí 1, Praha",
    buyerTaxId: "CZ12345678",
    buyerTaxIdType: "eu_vat",
    buyerCountryCode: "CZ",
    buyerEmail: "ucetni@kun.cz",
    currency: "PLN",
    subtotal: 150,
    totalVat: 23,
    total: 173,
    vatSummary: [
        { vatRate: 0, vatType: "exempt", netAmount: 50, vatAmount: 0, grossAmount: 50, vatLabel: "zw" },
        { vatRate: 23, vatType: "standard", netAmount: 100, vatAmount: 23, grossAmount: 123 },
    ],
    isReverseCharge: false,
    issueDate: "2026-10-30",
    dueDate: "2026-11-13",
    pdfUrl: null,
    pdfGeneratedAt: null,
    paymentStatus: "unpaid",
    paymentMethod: null,
    paidAt: null,
    cardLast4: null,
    externalRef: "booking-42",
    templateName: "brand",
    locale: "pl",
    sellerOverride: true,
    sellerEmail: "faktury@przestrzen.pl",
    sellerBankName: "mBank",
    sellerBankIban: "PL61109010140000071219812874",
    sellerBankSwift: "BREXPLPW",
    sellerBankAccountNumber: null,
    logoUrl: null,
    accentColor: "#0f766e",
    brandDisplayName: "Przestrzeń Coworking",
    paymentUrl: "https://pay.example.com/i/abc",
    legalNotes: ["Zwolnienie z VAT na podstawie art. 43 ust. 1 pkt 37 ustawy o VAT."],
    callbackUrl: null,
    callbackStatus: "none",
    callbackAttempts: 0,
    callbackLastAttemptAt: null,
    notes: "Dziękujemy!",
    terms: null,
    metadata: null,
    createdAt: "2026-10-30T00:00:00Z",
    updatedAt: "2026-10-30T00:00:00Z",
    ...overrides,
}) as any

const items = [
    { id: "a", invoiceId: "x", position: 1, description: "Biurko — październik", quantity: 1, unit: "mies.", unitPrice: 100, discountPercent: 0, vatRate: 23, vatAmount: 23, netAmount: 100, grossAmount: 123, vatLabel: null, createdAt: "" },
    { id: "b", invoiceId: "x", position: 2, description: "Adres do doręczeń", quantity: 1, unit: "szt.", unitPrice: 50, discountPercent: 0, vatRate: 0, vatAmount: 0, netAmount: 50, grossAmount: 50, vatLabel: "zw", createdAt: "" },
] as any

const platformOrg = { logoUrl: "https://cdn.platform.example/logo.png", bankName: "Platform Bank", bankIban: "SK00PLATFORM", bankSwift: "PLATSKBX", bankAccountNumber: null } as any

describe("brand template render smoke test", () => {
    it("is registered in the bundled template registry", () => {
        expect(resolveTemplateComponent("brand")).toBe(Brand)
    })

    it("renders an unpaid invoice in en", async () => {
        const pdf = await render(buildInvoiceProps(invoice({ locale: "en" }), items, platformOrg))
        expect(pdf.slice(0, 4)).toEqual(PDF_MAGIC)
    }, 30_000)

    it("renders an unpaid invoice in pl", async () => {
        const pdf = await render(buildInvoiceProps(invoice({ locale: "pl" }), items, platformOrg))
        expect(pdf.slice(0, 4)).toEqual(PDF_MAGIC)
    }, 30_000)

    it("renders an unpaid invoice in de", async () => {
        const pdf = await render(buildInvoiceProps(invoice({ locale: "de" }), items, platformOrg))
        expect(pdf.slice(0, 4)).toEqual(PDF_MAGIC)
    }, 30_000)

    it("renders an unpaid invoice in cs", async () => {
        const pdf = await render(buildInvoiceProps(invoice({ locale: "cs" }), items, platformOrg))
        expect(pdf.slice(0, 4)).toEqual(PDF_MAGIC)
    }, 30_000)

    it("renders an unpaid invoice in sk", async () => {
        const pdf = await render(buildInvoiceProps(invoice({ locale: "sk" }), items, platformOrg))
        expect(pdf.slice(0, 4)).toEqual(PDF_MAGIC)
    }, 30_000)

    it("renders a paid invoice with a data-URI logo, light accent and no locale", async () => {
        const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        const pdf = await render(buildInvoiceProps(invoice({
            locale: null, logoUrl: logo, accentColor: "#facc15",
            paymentStatus: "paid", paymentMethod: "card", paidAt: "2026-10-30T10:00:00Z", cardLast4: "4242",
        }), items, platformOrg))
        expect(pdf.slice(0, 4)).toEqual(PDF_MAGIC)
    }, 30_000)

    it("renders a minimal legacy-shaped invoice (no platform fields)", async () => {
        const pdf = await render(buildInvoiceProps(invoice({
            locale: null, sellerOverride: false, accentColor: null, brandDisplayName: null,
            paymentUrl: null, legalNotes: null, sellerEmail: null, vatSummary: [],
        }), items, platformOrg))
        expect(pdf.slice(0, 4)).toEqual(PDF_MAGIC)
    }, 30_000)
})

describe("locale labels", () => {
    it("uses Polish labels for pl", () => {
        const t = labelsFor("pl")
        expect(t.invoice).toBe("Faktura")
        expect(t.seller).toBe("Sprzedawca")
        expect(t.buyer).toBe("Nabywca")
        expect(t.issueDate).toBe("Data wystawienia")
        expect(t.dueDate).toBe("Termin płatności")
        expect(t.totalDue).toBe("Razem do zapłaty")
        expect(t.paid).toBe("Zapłacono")
        expect(t.due).toBe("Do zapłaty")
    })

    it("uses English labels for en", () => {
        const t = labelsFor("en")
        expect(t.invoice).toBe("Invoice")
        expect(t.totalDue).toBe("Total due")
        expect(t.payOnline).toBe("Pay online")
    })

    it("uses German labels for de", () => {
        const t = labelsFor("de")
        expect(t.invoice).toBe("Rechnung")
        expect(t.taxId).toBe("USt-IdNr.")
        expect(t.paid).toBe("Bezahlt")
    })

    it("uses Czech labels for cs", () => {
        const t = labelsFor("cs")
        expect(t.seller).toBe("Dodavatel")
        expect(t.buyer).toBe("Odběratel")
        expect(t.totalDue).toBe("Celkem k úhradě")
    })

    it("uses Slovak labels for sk", () => {
        const t = labelsFor("sk")
        expect(t.invoice).toBe("Faktúra")
        expect(t.seller).toBe("Dodávateľ")
        expect(t.totalDue).toBe("Spolu na úhradu")
    })

    it("falls back to Slovak labels without a locale", () => {
        expect(labelsFor(null).invoice).toBe("Faktúra")
        expect(labelsFor(undefined).invoice).toBe("Faktúra")
    })
})

describe("locale formatting", () => {
    it("formats Polish currency and dates", () => {
        const f = makeFormatters("pl", "PLN")
        // CLDR pl groups from 5 digits (minimumGroupingDigits = 2)
        expect(f.formatCurrency(1234.5).replace(/\s/g, " ")).toBe("1234,50 zł")
        expect(f.formatCurrency(12345.5).replace(/\s/g, " ")).toBe("12 345,50 zł")
        expect(f.formatDate("2026-10-30")).toBe("30.10.2026")
    })

    it("formats German currency and dates", () => {
        const f = makeFormatters("de", "EUR")
        expect(f.formatCurrency(1234.5).replace(/\s/g, " ")).toBe("1.234,50 €")
        expect(f.formatDate("2026-10-30")).toBe("30.10.2026")
    })

    it("formats English dates day-first (en-GB)", () => {
        const f = makeFormatters("en", "EUR")
        expect(f.formatDate("2026-10-30")).toBe("30/10/2026")
        expect(f.formatCurrency(1234.5)).toBe("€1,234.50")
    })

    it("keeps sk-SK formatting when no locale is set (existing behaviour)", () => {
        const f = makeFormatters(null, "EUR")
        expect(f.formatCurrency(1234.5)).toBe(new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(1234.5))
        expect(f.formatDate("2026-10-30")).toBe(new Date("2026-10-30").toLocaleDateString("sk-SK", { timeZone: "UTC" }))
    })
})

describe("template props source of logo and bank details", () => {
    it("uses invoice bank details and never the org's when the seller came from the request", () => {
        const props = buildInvoiceProps(invoice({ sellerOverride: true, logoUrl: null }), items, platformOrg)
        expect(props.bankIban).toBe("PL61109010140000071219812874")
        expect(props.bankName).toBe("mBank")
        expect(props.logoUrl).toBeNull()
    })

    it("shows no bank details for a request seller without bank details", () => {
        const props = buildInvoiceProps(invoice({ sellerOverride: true, sellerBankName: null, sellerBankIban: null, sellerBankSwift: null }), items, platformOrg)
        expect(props.bankIban).toBeNull()
        expect(props.bankName).toBeNull()
    })

    it("reads bank details and logo live from the org for org-snapshot invoices (existing behaviour)", () => {
        const props = buildInvoiceProps(invoice({ sellerOverride: false, logoUrl: null }), items, platformOrg)
        expect(props.bankIban).toBe("SK00PLATFORM")
        expect(props.logoUrl).toBe("https://cdn.platform.example/logo.png")
    })

    it("prefers the invoice branding logo over the org logo", () => {
        const props = buildInvoiceProps(invoice({ sellerOverride: false, logoUrl: "https://cdn.seller.example/logo.png" }), items, platformOrg)
        expect(props.logoUrl).toBe("https://cdn.seller.example/logo.png")
    })
})
