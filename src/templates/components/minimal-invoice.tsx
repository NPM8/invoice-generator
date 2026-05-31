import React from "react"
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import type { InvoicePropsType } from "../types.js"

// A compact single-column invoice — alternative to the default. Demonstrates the
// bundled-template pattern: default export, takes InvoicePropsType, returns a
// react-pdf <Document>. Numeric borders use *Width (react-pdf treats `border` as
// a string shorthand).
const styles = StyleSheet.create({
    page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#222" },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 2 },
    sub: { color: "#777", marginBottom: 20 },
    parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
    block: { width: "48%" },
    label: { fontSize: 8, color: "#999", textTransform: "uppercase", marginBottom: 3 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#eee" },
    headRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 2, borderBottomColor: "#222", fontWeight: "bold" },
    desc: { width: "70%" },
    amt: { width: "30%", textAlign: "right" },
    totals: { marginTop: 16, alignItems: "flex-end" },
    totalRow: { flexDirection: "row", justifyContent: "space-between", width: "45%", marginBottom: 3 },
    grand: { fontWeight: "bold", fontSize: 13, borderTopWidth: 1, borderTopColor: "#222", paddingTop: 4 },
    notice: { marginTop: 20, fontSize: 9, color: "#8a6d3b" },
})

export default function MinimalInvoice({
    invoiceNumber, issueDate, dueDate,
    sellerName, sellerAddress, sellerTaxId,
    buyerName, buyerAddress,
    currency, subtotal, totalVat, total, items, isReverseCharge,
    helpers: { formatCurrency, formatDate },
}: InvoicePropsType) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.title}>Invoice {invoiceNumber}</Text>
                <Text style={styles.sub}>
                    Issued {formatDate(issueDate)} · Due {formatDate(dueDate)}
                </Text>

                <View style={styles.parties}>
                    <View style={styles.block}>
                        <Text style={styles.label}>From</Text>
                        <Text>{sellerName}</Text>
                        <Text>{sellerAddress}</Text>
                        {sellerTaxId ? <Text>Tax ID: {sellerTaxId}</Text> : null}
                    </View>
                    <View style={styles.block}>
                        <Text style={styles.label}>Bill to</Text>
                        <Text>{buyerName}</Text>
                        {buyerAddress ? <Text>{buyerAddress}</Text> : null}
                    </View>
                </View>

                <View style={styles.headRow}>
                    <Text style={styles.desc}>Description</Text>
                    <Text style={styles.amt}>Amount</Text>
                </View>
                {items.map((it) => (
                    <View key={it.position} style={styles.row}>
                        <Text style={styles.desc}>
                            {it.description} · {it.quantity} {it.unit} × {formatCurrency(it.unitPrice, currency)}
                        </Text>
                        <Text style={styles.amt}>{formatCurrency(it.netAmount, currency)}</Text>
                    </View>
                ))}

                <View style={styles.totals}>
                    <View style={styles.totalRow}>
                        <Text>Subtotal</Text>
                        <Text>{formatCurrency(subtotal, currency)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text>VAT</Text>
                        <Text>{formatCurrency(totalVat, currency)}</Text>
                    </View>
                    <View style={[styles.totalRow, styles.grand]}>
                        <Text>Total</Text>
                        <Text>{formatCurrency(total, currency)}</Text>
                    </View>
                </View>

                {isReverseCharge ? (
                    <Text style={styles.notice}>Reverse charge — VAT to be accounted by the recipient.</Text>
                ) : null}
            </Page>
        </Document>
    )
}
