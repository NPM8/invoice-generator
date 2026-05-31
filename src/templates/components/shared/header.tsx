import React from "react"
import { View, Text, Image, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
    headerContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
    logoWrapper: { width: "50%" },
    logo: { width: 120, height: "auto" },
    titleSection: { width: "50%", alignItems: "flex-end" },
    title: { fontSize: 24, fontWeight: "bold", textTransform: "uppercase", marginBottom: 10, color: "#222" },
    metaRow: { flexDirection: "row", marginBottom: 3 },
    metaLabel: { width: 70, color: "#666", textAlign: "right", marginRight: 10 },
    metaValue: { width: 90, textAlign: "right", fontWeight: "bold" },

    addressContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 20 },
    addressBlock: { width: "45%" },
    addressTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 8, color: "#666", textTransform: "uppercase" },
    addressText: { marginBottom: 3, lineHeight: 1.4 },
    h1: { fontWeight: "bold" }
})

interface HeaderProps {
    logoUrl?: string | null | undefined
    invoiceNumber: string
    issueDate: string
    dueDate: string
    formatDate: (d: string) => string

    sellerName: string
    sellerAddress: string
    sellerTaxId?: string | null | undefined

    buyerName: string
    buyerAddress?: string | null | undefined
    buyerTaxId?: string | null | undefined
}

export function Header(props: HeaderProps) {
    return (
        <View>
            <View style={styles.headerContainer}>
                <View style={styles.logoWrapper}>
                    {props.logoUrl && <Image src={props.logoUrl} style={styles.logo} />}
                </View>
                <View style={styles.titleSection}>
                    <Text style={styles.title}>Invoice</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Invoice No:</Text>
                        <Text style={styles.metaValue}>{props.invoiceNumber}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Issue Date:</Text>
                        <Text style={styles.metaValue}>{props.formatDate(props.issueDate)}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Due Date:</Text>
                        <Text style={styles.metaValue}>{props.formatDate(props.dueDate)}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.addressContainer}>
                <View style={styles.addressBlock}>
                    <Text style={styles.addressTitle}>From</Text>
                    <Text style={[styles.addressText, styles.h1]}>{props.sellerName}</Text>
                    <Text style={styles.addressText}>{props.sellerAddress}</Text>
                    {props.sellerTaxId && <Text style={styles.addressText}>VAT ID: {props.sellerTaxId}</Text>}
                </View>

                <View style={styles.addressBlock}>
                    <Text style={styles.addressTitle}>Bill To</Text>
                    <Text style={[styles.addressText, styles.h1]}>{props.buyerName}</Text>
                    {props.buyerAddress && <Text style={styles.addressText}>{props.buyerAddress}</Text>}
                    {props.buyerTaxId && <Text style={styles.addressText}>VAT ID: {props.buyerTaxId}</Text>}
                </View>
            </View>
        </View>
    )
}
