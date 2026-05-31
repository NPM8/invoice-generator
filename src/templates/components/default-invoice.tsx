import React from "react"
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import type { InvoicePropsType } from "../types.js"

import { Header } from "./shared/header.js"
import { ItemsTable } from "./shared/items-table.js"
import { VatSummary } from "./shared/vat-summary.js"
import { PaymentDetails } from "./shared/payment-details.js"
import { Footer } from "./shared/footer.js"

// "Helvetica" is a PDF standard built-in font in @react-pdf/renderer.
// It (and its bold variant via fontWeight) resolves automatically without
// Font.register, which requires a real font `src` per FontSource.

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#333", backgroundColor: "#fff" },
    notesBox: { marginBottom: 15 },
    notesTitle: { fontWeight: "bold", marginBottom: 5 },
    termsBox: { marginBottom: 30 },
    termsTitle: { fontWeight: "bold", marginBottom: 5 }
})

export default function DefaultInvoice({
    invoiceNumber, issueDate, dueDate, sellerName, sellerAddress, sellerTaxId,
    buyerName, buyerAddress, buyerTaxId, currency, subtotal, totalVat, total,
    items, vatSummary, isReverseCharge, logoUrl, bankName, bankIban,
    bankSwift, bankAccountNumber, notes, terms, helpers: { formatCurrency, formatDate }
}: InvoicePropsType) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <Header
                    logoUrl={logoUrl}
                    invoiceNumber={invoiceNumber}
                    issueDate={issueDate}
                    dueDate={dueDate}
                    formatDate={formatDate}
                    sellerName={sellerName}
                    sellerAddress={sellerAddress}
                    sellerTaxId={sellerTaxId}
                    buyerName={buyerName}
                    buyerAddress={buyerAddress}
                    buyerTaxId={buyerTaxId}
                />

                <ItemsTable
                    items={items}
                    currency={currency}
                    formatCurrency={formatCurrency}
                />

                <VatSummary
                    vatSummary={vatSummary}
                    subtotal={subtotal}
                    totalVat={totalVat}
                    total={total}
                    currency={currency}
                    isReverseCharge={isReverseCharge}
                    formatCurrency={formatCurrency}
                />

                <PaymentDetails
                    bankName={bankName}
                    bankIban={bankIban}
                    bankSwift={bankSwift}
                    bankAccountNumber={bankAccountNumber}
                />

                {notes && (
                    <View style={styles.notesBox}>
                        <Text style={styles.notesTitle}>Notes</Text>
                        <Text>{notes}</Text>
                    </View>
                )}

                {terms && (
                    <View style={styles.termsBox}>
                        <Text style={styles.termsTitle}>Terms</Text>
                        <Text>{terms}</Text>
                    </View>
                )}

                <Footer
                    sellerName={sellerName}
                    sellerAddress={sellerAddress}
                    sellerTaxId={sellerTaxId}
                />

            </Page>
        </Document>
    )
}
