import React from "react"
import { View, Text, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
    table: { width: "100%", marginBottom: 30 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f9f9f9", padding: 8, borderBottomWidth: 1, borderBottomColor: "#ddd", fontWeight: "bold" },
    tableRow: { flexDirection: "row", padding: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
    colPos: { width: "5%" },
    colDesc: { width: "35%" },
    colQty: { width: "10%", textAlign: "right" },
    colUnit: { width: "15%", textAlign: "right" },
    colVat: { width: "10%", textAlign: "right" },
    colNet: { width: "10%", textAlign: "right" },
    colGross: { width: "15%", textAlign: "right" },
})

interface ItemsTableProps {
    items: Array<{
        position: number
        description: string
        quantity: number
        unit: string
        unitPrice: number
        vatRate: number
        netAmount: number
        grossAmount: number
    }>
    currency: string
    formatCurrency: (amount: number, currency: string) => string
}

export function ItemsTable({ items, currency, formatCurrency }: ItemsTableProps) {
    return (
        <View style={styles.table}>
            <View style={styles.tableHeader}>
                <Text style={styles.colPos}>#</Text>
                <Text style={styles.colDesc}>Description</Text>
                <Text style={styles.colQty}>Qty</Text>
                <Text style={styles.colUnit}>Price</Text>
                <Text style={styles.colNet}>Net</Text>
                <Text style={styles.colVat}>VAT%</Text>
                <Text style={styles.colGross}>Gross</Text>
            </View>
            {items.map((item, i) => (
                <View key={i} style={styles.tableRow}>
                    <Text style={styles.colPos}>{item.position}</Text>
                    <Text style={styles.colDesc}>{item.description}</Text>
                    <Text style={styles.colQty}>{item.quantity}</Text>
                    <Text style={styles.colUnit}>{formatCurrency(item.unitPrice, currency)}</Text>
                    <Text style={styles.colNet}>{formatCurrency(item.netAmount, currency)}</Text>
                    <Text style={styles.colVat}>{item.vatRate}%</Text>
                    <Text style={styles.colGross}>{formatCurrency(item.grossAmount, currency)}</Text>
                </View>
            ))}
        </View>
    )
}
