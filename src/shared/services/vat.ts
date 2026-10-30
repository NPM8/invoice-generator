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
    vatLabel?: string | null
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

type SummaryLine = {
    netAmount: number
    vatAmount: number
    grossAmount: number
    vatRate: number
    vatType: VatType
    vatLabel?: string | null | undefined
}

/** Default grouping (calculated invoices): one entry per VAT rate. */
export const groupByRate = (line: SummaryLine): string => String(line.vatRate)

/** Grouping for caller-supplied amounts: rate + type + label (e.g. 0% "zw" vs 0% "np"). */
export const groupByRateTypeLabel = (line: SummaryLine): string =>
    `${line.vatRate}|${line.vatType}|${line.vatLabel ?? ""}`

const round2 = (n: number) => Number(n.toFixed(2))

export function computeVatSummary(
    lines: Array<SummaryLine>,
    groupKey: (line: SummaryLine) => string = groupByRate
): VatSummaryEntry[] {
    const groups = lines.reduce((acc, line) => {
        const key = groupKey(line)
        const current = acc.get(key)
        return acc.set(key, current
            ? {
                ...current,
                netAmount: current.netAmount + line.netAmount,
                vatAmount: current.vatAmount + line.vatAmount,
                grossAmount: current.grossAmount + line.grossAmount,
            }
            : {
                vatRate: line.vatRate,
                vatType: line.vatType,
                netAmount: line.netAmount,
                vatAmount: line.vatAmount,
                grossAmount: line.grossAmount,
                ...(line.vatLabel ? { vatLabel: line.vatLabel } : {}),
            })
    }, new Map<string, VatSummaryEntry>())

    return Array.from(groups.values())
        .map((entry) => ({
            ...entry,
            netAmount: round2(entry.netAmount),
            vatAmount: round2(entry.vatAmount),
            grossAmount: round2(entry.grossAmount),
        }))
        .sort((a, b) => a.vatRate - b.vatRate)
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
