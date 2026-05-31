import React from "react"
import { View, Text, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
    bottomSection: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
    vatSummaryBox: { width: "45%", borderWidth: 1, borderColor: "#eee", padding: 10, borderRadius: 2 },
    vatSummaryTitle: { fontWeight: "bold", marginBottom: 6, fontSize: 9 },
    vatRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3, fontSize: 9 },

    totalsBox: { width: "45%", backgroundColor: "#f9f9f9", padding: 10, borderRadius: 4 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    totalLabel: { fontWeight: "normal" },
    totalValue: { textAlign: "right" },
    totalFinalLabel: { fontWeight: "bold", fontSize: 13 },
    totalFinalValue: { fontWeight: "bold", fontSize: 13, textAlign: "right" },

    notice: { marginTop: 15, padding: 10, backgroundColor: "#fdf8e4", color: "#8a6d3b", borderRadius: 3, fontSize: 9 }
})

interface VatSummaryProps {
    vatSummary: Array<{
        vatRate: number
        netAmount: number
        vatAmount: number
    }>
    subtotal: number
    totalVat: number
    total: number
    currency: string
    isReverseCharge: boolean
    formatCurrency: (amount: number, currency: string) => string
}

export function VatSummary({
    vatSummary, subtotal, totalVat, total, currency, isReverseCharge, formatCurrency
}: VatSummaryProps) {
    return (
        <View style={styles.bottomSection}>
            <View style={styles.vatSummaryBox}>
                <Text style={styles.vatSummaryTitle}>VAT Summary</Text>
                {vatSummary.map((v, i) => (
                    <View key={i} style={styles.vatRow}>
                        <Text>{v.vatRate}%</Text>
                        <Text>Net: {formatCurrency(v.netAmount, currency)}</Text>
                        <Text>VAT: {formatCurrency(v.vatAmount, currency)}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.totalsBox}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>{formatCurrency(subtotal, currency)}</Text>
                </View>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total VAT</Text>
                    <Text style={styles.totalValue}>{formatCurrency(totalVat, currency)}</Text>
                </View>
                <View style={[styles.totalRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ddd" }]}>
                    <Text style={styles.totalFinalLabel}>Total Due</Text>
                    <Text style={styles.totalFinalValue}>{formatCurrency(total, currency)}</Text>
                </View>
                {isReverseCharge && (
                    <View style={styles.notice}>
                        <Text>Reverse Charge: Customer to account for VAT to their local tax authority.</Text>
                    </View>
                )}
            </View>
        </View>
    )
}
