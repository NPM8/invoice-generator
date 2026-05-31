// Pure VAT calculation functions

export type VatType = "standard" | "reverse_charge" | "zero_rated" | "exempt"

export interface LineVatResult {
    netAmount: number
    vatAmount: number
    grossAmount: number
}

export interface VatSummaryEntry {
    vatRate: number
    vatType: VatType
    netAmount: number
    vatAmount: number
    grossAmount: number
}

export function calculateLineVat(
    quantity: number,
    unitPrice: number,
    discountPercent: number,
    vatRate: number,
    vatType: VatType
): LineVatResult {
    const lineTotal = quantity * unitPrice
    const discountAmount = lineTotal * (discountPercent / 100)
    const netAmount = Number((lineTotal - discountAmount).toFixed(2))

    if (vatType === "reverse_charge" || vatType === "zero_rated" || vatType === "exempt") {
        return {
            netAmount,
            vatAmount: 0,
            grossAmount: netAmount,
        }
    }

    const vatAmount = Number((netAmount * (vatRate / 100)).toFixed(2))
    const grossAmount = Number((netAmount + vatAmount).toFixed(2))

    return { netAmount, vatAmount, grossAmount }
}

export function computeVatSummary(
    lines: Array<{
        netAmount: number
        vatAmount: number
        grossAmount: number
        vatRate: number
        vatType: VatType
    }>
): VatSummaryEntry[] {
    const summaryMap = new Map<number, VatSummaryEntry>()

    for (const line of lines) {
        const rate = line.vatRate
        const current = summaryMap.get(rate) || {
            vatRate: rate,
            vatType: line.vatType,
            netAmount: 0,
            vatAmount: 0,
            grossAmount: 0,
        }

        current.netAmount += line.netAmount
        current.vatAmount += line.vatAmount
        current.grossAmount += line.grossAmount

        summaryMap.set(rate, current)
    }

    const result = Array.from(summaryMap.values()).map((entry) => ({
        vatRate: entry.vatRate,
        vatType: entry.vatType,
        netAmount: Number(entry.netAmount.toFixed(2)),
        vatAmount: Number(entry.vatAmount.toFixed(2)),
        grossAmount: Number(entry.grossAmount.toFixed(2)),
    }))

    return result.sort((a, b) => a.vatRate - b.vatRate)
}

export function computeInvoiceTotals(
    lines: Array<{
        netAmount: number
        vatAmount: number
        grossAmount: number
    }>
) {
    let subtotal = 0
    let totalVat = 0
    let total = 0

    for (const line of lines) {
        subtotal += line.netAmount
        totalVat += line.vatAmount
        total += line.grossAmount
    }

    return {
        subtotal: Number(subtotal.toFixed(2)),
        totalVat: Number(totalVat.toFixed(2)),
        total: Number(total.toFixed(2)),
    }
}

export function determineReverseCharge(
    sellerCountry: string,
    buyerCountry: string,
    buyerVatId: string | null | undefined
): boolean {
    // Simple heuristic: if different countries, both in EU (simplified to just checking if different and buyer VAT exists),
    // but let's implement the standard rule: Cross-border B2B is usually reverse charge.
    if (sellerCountry === buyerCountry) return false
    if (!buyerVatId || buyerVatId.trim() === "") return false

    // Real implementation would check if both are in EU, but for now:
    // If it's B2B and international, default to reverse charge.
    return true
}
