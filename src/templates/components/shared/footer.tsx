import React from "react"
import { View, Text, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
    footer: { position: "absolute", bottom: 40, left: 40, right: 40, borderTop: 1, borderTopColor: "#eee", paddingTop: 10 },
    footerText: { fontSize: 8, color: "#777", textAlign: "center", marginBottom: 2 }
})

interface FooterProps {
    sellerName: string
    sellerAddress: string
    sellerTaxId?: string | null
}

export function Footer({ sellerName, sellerAddress, sellerTaxId }: FooterProps) {
    return (
        <View style={styles.footer} fixed>
            <Text style={styles.footerText}>{sellerName} • {sellerAddress}</Text>
            {sellerTaxId && <Text style={styles.footerText}>VAT/Tax ID: {sellerTaxId}</Text>}
        </View>
    )
}
