import React from "react"
import { View, Text, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
    paymentBox: { marginBottom: 20, padding: 12, backgroundColor: "#f4f7f6", borderRadius: 4 },
    paymentTitle: { fontWeight: "bold", marginBottom: 6 },
    paymentRow: { flexDirection: "row", marginBottom: 3 },
    paymentLabel: { width: 100, color: "#555" },
    paymentValue: { fontWeight: "bold" },
})

interface PaymentDetailsProps {
    bankName?: string | null | undefined
    bankIban?: string | null | undefined
    bankSwift?: string | null | undefined
    bankAccountNumber?: string | null | undefined
}

export function PaymentDetails({ bankName, bankIban, bankSwift, bankAccountNumber }: PaymentDetailsProps) {
    if (!bankName && !bankIban) return null

    return (
        <View style={styles.paymentBox}>
            <Text style={styles.paymentTitle}>Payment Details</Text>
            {bankName && <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Bank:</Text><Text style={styles.paymentValue}>{bankName}</Text></View>}
            {bankIban && <View style={styles.paymentRow}><Text style={styles.paymentLabel}>IBAN:</Text><Text style={styles.paymentValue}>{bankIban}</Text></View>}
            {bankSwift && <View style={styles.paymentRow}><Text style={styles.paymentLabel}>SWIFT/BIC:</Text><Text style={styles.paymentValue}>{bankSwift}</Text></View>}
            {bankAccountNumber && <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Account:</Text><Text style={styles.paymentValue}>{bankAccountNumber}</Text></View>}
        </View>
    )
}
