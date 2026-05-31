import React from "react"
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import type { InvoicePropsType } from "../types.js"
import { UNICODE_FONT, registerUnicodeFont } from "../fonts.js"

// "Run, Bekim! Run!" — minimal, whitespace-led invoice in Slovak.
// Palette from the brand site: blue #0253a2 labels, near-black ink, crimson
// #c80e45 accent. Numeric borders use *Width (react-pdf treats `border` as a
// string shorthand). Uses DejaVu Sans (Latin-2) so Slovak diacritics render.
registerUnicodeFont()

const BLUE = "#0253a2"
const CRIMSON = "#c80e45"
const INK = "#1b1b1b"
const MUTED = "#777"
const LINE = "#e7e7e7"

const styles = StyleSheet.create({
    page: { padding: 48, fontFamily: UNICODE_FONT, fontSize: 10, color: INK },

    top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 },
    title: { fontSize: 16, fontWeight: "bold" },
    titleSub: { color: MUTED, fontSize: 8, marginTop: 3 },
    logo: { height: 34, objectFit: "contain" },

    parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
    block: { width: "48%" },
    blockRight: { width: "48%", alignItems: "flex-end" },
    label: { fontSize: 7, color: BLUE, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
    strong: { fontWeight: "bold" },
    line: { color: MUTED, fontSize: 9 },

    itemsHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 5, marginBottom: 2 },
    headDesc: { width: "70%", fontSize: 7, color: BLUE, letterSpacing: 1, textTransform: "uppercase" },
    headAmt: { width: "30%", fontSize: 7, color: BLUE, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" },
    row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: LINE },
    desc: { width: "70%" },
    descSub: { color: MUTED, fontSize: 8, marginTop: 2 },
    amt: { width: "30%", textAlign: "right" },

    totals: { marginTop: 18, marginLeft: "auto", width: "48%" },
    trow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, color: MUTED },
    grand: {
        flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 8,
        borderTopWidth: 1, borderTopColor: INK,
    },
    grandLabel: { fontWeight: "bold", fontSize: 13 },
    grandValue: { fontWeight: "bold", fontSize: 13, color: CRIMSON },

    notice: { marginTop: 18, fontSize: 9, color: CRIMSON },
    paidBadge: { marginTop: 16, padding: 8, borderWidth: 1, borderColor: "#1a7f37", borderRadius: 3, color: "#1a7f37", fontWeight: "bold" },
    section: { marginTop: 22 },
    sectionBody: { color: MUTED, fontSize: 9, marginTop: 3 },

    footer: { position: "absolute", left: 48, right: 48, bottom: 36, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, color: MUTED, fontSize: 8, textAlign: "center" },
})

export default function BekimMinimal({
    invoiceNumber, issueDate, dueDate,
    sellerName, sellerAddress, sellerTaxId,
    buyerName, buyerAddress, buyerTaxId,
    currency, subtotal, totalVat, total, items, isReverseCharge,
    logoUrl, bankName, bankIban, bankSwift,
    paymentStatus, paymentMethod, paidAt, cardLast4,
    notes, terms,
    helpers: { formatCurrency, formatDate },
}: InvoicePropsType) {
    const paid = paymentStatus === "paid"
    const methodLabel =
        paymentMethod === "card" ? "kartou"
            : paymentMethod === "bank_transfer" ? "prevodom"
                : paymentMethod === "cash" ? "v hotovosti"
                    : ""
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.top}>
                    <View>
                        <Text style={styles.title}>Faktúra {invoiceNumber}</Text>
                        <Text style={styles.titleSub}>
                            Vystavené {formatDate(issueDate)} · Splatnosť {formatDate(dueDate)}
                        </Text>
                    </View>
                    {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
                </View>

                <View style={styles.parties}>
                    <View style={styles.block}>
                        <Text style={styles.label}>Dodávateľ</Text>
                        <Text style={styles.strong}>{sellerName}</Text>
                        <Text style={styles.line}>{sellerAddress}</Text>
                        {sellerTaxId ? <Text style={styles.line}>IČ DPH: {sellerTaxId}</Text> : null}
                    </View>
                    <View style={styles.blockRight}>
                        <Text style={styles.label}>Odberateľ</Text>
                        <Text style={styles.strong}>{buyerName}</Text>
                        {buyerAddress ? <Text style={styles.line}>{buyerAddress}</Text> : null}
                        {buyerTaxId ? <Text style={styles.line}>IČ DPH: {buyerTaxId}</Text> : null}
                    </View>
                </View>

                <View style={styles.itemsHead}>
                    <Text style={styles.headDesc}>Popis</Text>
                    <Text style={styles.headAmt}>Suma</Text>
                </View>
                {items.map((it) => (
                    <View key={it.position} style={styles.row}>
                        <View style={styles.desc}>
                            <Text>{it.description}</Text>
                            <Text style={styles.descSub}>
                                {it.quantity} {it.unit} × {formatCurrency(it.unitPrice, currency)}
                                {it.discountPercent > 0 ? ` · zľava ${it.discountPercent}%` : ""} · DPH {it.vatRate}%
                            </Text>
                        </View>
                        <Text style={styles.amt}>{formatCurrency(it.netAmount, currency)}</Text>
                    </View>
                ))}

                <View style={styles.totals}>
                    <View style={styles.trow}>
                        <Text>Medzisúčet</Text>
                        <Text>{formatCurrency(subtotal, currency)}</Text>
                    </View>
                    <View style={styles.trow}>
                        <Text>DPH</Text>
                        <Text>{formatCurrency(totalVat, currency)}</Text>
                    </View>
                    <View style={styles.grand}>
                        <Text style={styles.grandLabel}>Spolu na úhradu</Text>
                        <Text style={styles.grandValue}>{formatCurrency(total, currency)}</Text>
                    </View>
                </View>

                {isReverseCharge ? (
                    <Text style={styles.notice}>Prenesenie daňovej povinnosti — DPH odvedie príjemca.</Text>
                ) : null}

                {paid ? (
                    // Recorded as paid (e.g. by card at checkout) — show that instead of bank details.
                    <Text style={styles.paidBadge}>
                        ✓ Zaplatené{methodLabel ? ` ${methodLabel}` : ""}
                        {cardLast4 ? ` •••• ${cardLast4}` : ""}
                        {paidAt ? ` · ${formatDate(paidAt)}` : ""}
                    </Text>
                ) : (bankIban || bankName) ? (
                    <View style={styles.section}>
                        <Text style={styles.label}>Platobné údaje</Text>
                        <Text style={styles.sectionBody}>
                            {[bankName, bankIban ? `IBAN: ${bankIban}` : null, bankSwift ? `SWIFT: ${bankSwift}` : null]
                                .filter(Boolean)
                                .join("   ·   ")}
                        </Text>
                    </View>
                ) : null}

                {notes ? (
                    <View style={styles.section}>
                        <Text style={styles.label}>Poznámky</Text>
                        <Text style={styles.sectionBody}>{notes}</Text>
                    </View>
                ) : null}

                {terms ? (
                    <View style={styles.section}>
                        <Text style={styles.label}>Podmienky</Text>
                        <Text style={styles.sectionBody}>{terms}</Text>
                    </View>
                ) : null}

                <Text style={styles.footer}>{sellerName} · Ďakujeme za podporu — Run, Bekim! Run!</Text>
            </Page>
        </Document>
    )
}
