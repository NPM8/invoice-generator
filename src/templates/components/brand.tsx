import React from "react"
import { Document, Page, View, Text, Image, Link, StyleSheet } from "@react-pdf/renderer"
import type { InvoicePropsType } from "../types.js"
import { UNICODE_FONT, registerUnicodeFont } from "../fonts.js"
import { labelsFor } from "../i18n.js"

// "brand" — clean, modern A4 invoice for platform mode: the seller's logo (or
// display name), one accent colour used for the header rule, table header and
// the total band, and labels in the invoice locale (en/pl/de/cs/sk).
// DejaVu Sans renders Polish/Czech/Slovak/German diacritics. Numeric borders use
// *Width (react-pdf treats `border` as a string shorthand).
registerUnicodeFont()

const DEFAULT_ACCENT = "#2563eb"
const INK = "#111827"
const MUTED = "#6b7280"
const LINE = "#e5e7eb"
const SOFT = "#f8fafc"
const GREEN = "#15803d"
const WHITE = "#ffffff"

// --- Colour helpers (accent comes from the caller, so derive readable variants) ---

const toRgb = (hex: string): [number, number, number] =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

const toHex = (rgb: ReadonlyArray<number>) =>
    `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`

const isLight = (hex: string) => {
    const [r, g, b] = toRgb(hex)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

/** Mix with white: amount 0 = colour, 1 = white. */
const tint = (hex: string, amount: number) => toHex(toRgb(hex).map((c) => c + (255 - c) * amount))

const validAccent = (hex: string | null | undefined) =>
    hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_ACCENT

// --- Styles ---

const styles = StyleSheet.create({
    page: { paddingTop: 40, paddingBottom: 64, paddingHorizontal: 44, fontFamily: UNICODE_FONT, fontSize: 9, color: INK },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    logo: { maxHeight: 48, maxWidth: 180, objectFit: "contain" },
    brandName: { fontSize: 17, fontWeight: "bold" },
    titleBox: { alignItems: "flex-end" },
    title: { fontSize: 8, color: MUTED, letterSpacing: 2, textTransform: "uppercase" },
    number: { fontSize: 17, fontWeight: "bold", marginTop: 2 },
    rule: { height: 2, marginTop: 16, marginBottom: 16 },

    meta: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    metaCell: { marginRight: 32 },
    metaLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
    metaValue: { fontSize: 10, fontWeight: "bold", marginTop: 2 },
    badge: { marginLeft: "auto", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, fontSize: 8, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 },

    parties: { flexDirection: "row", marginBottom: 18 },
    party: { flex: 1, padding: 12, backgroundColor: SOFT, borderRadius: 4 },
    partyGap: { width: 12 },
    partyLabel: { fontSize: 7, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5, fontWeight: "bold" },
    partyName: { fontSize: 10.5, fontWeight: "bold", marginBottom: 2 },
    partyLine: { color: MUTED, marginTop: 1.5 },

    tableHead: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderRadius: 3 },
    th: { fontSize: 7, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 },
    row: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: LINE },
    cDesc: { flex: 1, paddingRight: 8 },
    cQty: { width: "9%", textAlign: "right" },
    cUnit: { width: "8%", textAlign: "center", paddingLeft: 4 },
    cPrice: { width: "14%", textAlign: "right", paddingLeft: 4 },
    cVat: { width: "8%", textAlign: "right", paddingLeft: 4 },
    cNet: { width: "15%", textAlign: "right", paddingLeft: 4 },
    cGross: { width: "15%", textAlign: "right", paddingLeft: 4 },
    sub: { color: MUTED, fontSize: 7.5, marginTop: 1 },

    summary: { flexDirection: "row", marginTop: 18, alignItems: "flex-start" },
    vatBox: { flex: 1, marginRight: 24 },
    sectionLabel: { fontSize: 7, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5, fontWeight: "bold" },
    vatRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: LINE },
    vatHead: { color: MUTED, fontSize: 7 },
    vRate: { width: "16%" },
    vAmt: { width: "28%", textAlign: "right" },

    totals: { width: "45%" },
    trow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, color: MUTED },
    band: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 4 },
    bandLabel: { flex: 1, marginRight: 8, fontSize: 10, fontWeight: "bold" },
    bandValue: { fontSize: 13, fontWeight: "bold", textAlign: "right" },

    notice: { marginTop: 12, fontSize: 8.5, fontWeight: "bold" },

    section: { marginTop: 16 },
    legalBox: { marginTop: 16, paddingTop: 6, borderTopWidth: 1, borderTopColor: LINE },
    paidBox: { marginTop: 16, padding: 10, borderRadius: 4, borderWidth: 1, borderColor: GREEN, color: GREEN, fontWeight: "bold" },
    payGrid: { flexDirection: "row", flexWrap: "wrap" },
    payCell: { width: "50%", marginBottom: 5 },
    payLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
    payValue: { fontSize: 9.5, fontWeight: "bold", marginTop: 1 },
    payButton: { marginTop: 8, alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 14, borderRadius: 4, fontSize: 9, fontWeight: "bold", textDecoration: "none" },
    payUrl: { marginTop: 4, fontSize: 7, color: MUTED },

    body: { color: MUTED },
    legal: { color: MUTED, fontSize: 7.5, marginTop: 2 },

    footer: { position: "absolute", left: 44, right: 44, bottom: 28, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 7, paddingRight: 80, color: MUTED, fontSize: 7.5 },
    pageNumber: { position: "absolute", left: 44, right: 44, bottom: 28, textAlign: "right", color: MUTED, fontSize: 7.5 },
})

const Field = ({ label, value }: { label: string; value: string | null | undefined }) =>
    value ? <Text style={styles.partyLine}>{label}: {value}</Text> : null

const PayCell = ({ label, value }: { label: string; value: string | null | undefined }) =>
    value ? (
        <View style={styles.payCell}>
            <Text style={styles.payLabel}>{label}</Text>
            <Text style={styles.payValue}>{value}</Text>
        </View>
    ) : null

export default function Brand({
    invoiceNumber, issueDate, dueDate,
    sellerName, sellerAddress, sellerTaxId, sellerEmail,
    sellerCompanyRegistrationNumber, sellerLocalTaxId, sellerRegistrationDetails,
    buyerName, buyerAddress, buyerTaxId, buyerEmail,
    currency, subtotal, totalVat, total, items, vatSummary, isReverseCharge,
    logoUrl, bankName, bankIban, bankSwift, bankAccountNumber,
    paymentStatus, paymentMethod, paidAt, cardLast4, paymentUrl,
    locale, accentColor, brandDisplayName, legalNotes,
    notes, terms,
    helpers: { formatCurrency, formatDate, formatNumber = String },
}: InvoicePropsType) {
    const t = labelsFor(locale)
    const accent = validAccent(accentColor)
    const onAccent = isLight(accent) ? INK : WHITE
    const accentText = isLight(accent) ? INK : accent
    const accentSoft = tint(accent, 0.9)
    const paid = paymentStatus === "paid"
    const money = (amount: number) => formatCurrency(amount, currency)
    const method = paymentMethod ? t.paymentMethods[paymentMethod as keyof typeof t.paymentMethods] ?? "" : ""
    const vatLabel = (label: string | null | undefined, rate: number) => label || `${formatNumber(rate)} %`
    const hasBankDetails = Boolean(bankName || bankIban || bankAccountNumber)

    return (
        <Document title={`${t.invoice} ${invoiceNumber}`} author={brandDisplayName || sellerName}>
            <Page size="A4" style={styles.page}>
                {/* Header: brand left, document title + number right */}
                <View style={styles.header}>
                    {logoUrl
                        ? <Image src={logoUrl} style={styles.logo} />
                        : <Text style={[styles.brandName, { color: accentText }]}>{brandDisplayName || sellerName}</Text>}
                    <View style={styles.titleBox}>
                        <Text style={styles.title}>{t.invoice}</Text>
                        <Text style={styles.number}>{invoiceNumber}</Text>
                    </View>
                </View>
                <View style={[styles.rule, { backgroundColor: accent }]} />

                {/* Dates + payment status */}
                <View style={styles.meta}>
                    <View style={styles.metaCell}>
                        <Text style={styles.metaLabel}>{t.issueDate}</Text>
                        <Text style={styles.metaValue}>{formatDate(issueDate)}</Text>
                    </View>
                    <View style={styles.metaCell}>
                        <Text style={styles.metaLabel}>{t.dueDate}</Text>
                        <Text style={styles.metaValue}>{formatDate(dueDate)}</Text>
                    </View>
                    <Text
                        style={[
                            styles.badge,
                            paid
                                ? { color: GREEN, backgroundColor: tint(GREEN, 0.88) }
                                : { color: accentText, backgroundColor: accentSoft },
                        ]}
                    >
                        {paid ? `✓ ${t.paid}` : t.due}
                    </Text>
                </View>

                {/* Parties */}
                <View style={styles.parties}>
                    <View style={styles.party}>
                        <Text style={[styles.partyLabel, { color: accentText }]}>{t.seller}</Text>
                        <Text style={styles.partyName}>{sellerName}</Text>
                        <Text style={styles.partyLine}>{sellerAddress}</Text>
                        <Field label={t.companyRegistrationNumber} value={sellerCompanyRegistrationNumber} />
                        <Field label={t.localTaxId} value={sellerLocalTaxId} />
                        <Field label={t.taxId} value={sellerTaxId} />
                        <Field label={t.email} value={sellerEmail} />
                        {sellerRegistrationDetails ? <Text style={styles.partyLine}>{sellerRegistrationDetails}</Text> : null}
                    </View>
                    <View style={styles.partyGap} />
                    <View style={styles.party}>
                        <Text style={[styles.partyLabel, { color: accentText }]}>{t.buyer}</Text>
                        <Text style={styles.partyName}>{buyerName}</Text>
                        {buyerAddress ? <Text style={styles.partyLine}>{buyerAddress}</Text> : null}
                        <Field label={t.taxId} value={buyerTaxId} />
                        <Field label={t.email} value={buyerEmail} />
                    </View>
                </View>

                {/* Items */}
                <View style={[styles.tableHead, { backgroundColor: accentSoft }]}>
                    <Text style={[styles.th, styles.cDesc, { color: accentText }]}>{t.description}</Text>
                    <Text style={[styles.th, styles.cQty, { color: accentText }]}>{t.quantity}</Text>
                    <Text style={[styles.th, styles.cUnit, { color: accentText }]}>{t.unit}</Text>
                    <Text style={[styles.th, styles.cPrice, { color: accentText }]}>{t.unitPrice}</Text>
                    <Text style={[styles.th, styles.cVat, { color: accentText }]}>{t.vatRate}</Text>
                    <Text style={[styles.th, styles.cNet, { color: accentText }]}>{t.net}</Text>
                    <Text style={[styles.th, styles.cGross, { color: accentText }]}>{t.gross}</Text>
                </View>
                {items.map((it) => (
                    <View key={it.position} style={styles.row} wrap={false}>
                        <View style={styles.cDesc}>
                            <Text>{it.description}</Text>
                            {it.discountPercent > 0 ? <Text style={styles.sub}>−{formatNumber(it.discountPercent)} %</Text> : null}
                        </View>
                        <Text style={styles.cQty}>{formatNumber(it.quantity)}</Text>
                        <Text style={styles.cUnit}>{it.unit}</Text>
                        <Text style={styles.cPrice}>{money(it.unitPrice)}</Text>
                        <Text style={styles.cVat}>{vatLabel(it.vatLabel, it.vatRate)}</Text>
                        <Text style={styles.cNet}>{money(it.netAmount)}</Text>
                        <Text style={styles.cGross}>{money(it.grossAmount)}</Text>
                    </View>
                ))}

                {/* VAT summary + totals */}
                <View style={styles.summary} wrap={false}>
                    <View style={styles.vatBox}>
                        {vatSummary.length > 0 ? (
                            <>
                                <Text style={[styles.sectionLabel, { color: accentText }]}>{t.vatSummary}</Text>
                                <View style={[styles.vatRow, styles.vatHead]}>
                                    <Text style={styles.vRate}>{t.vatRate}</Text>
                                    <Text style={styles.vAmt}>{t.net}</Text>
                                    <Text style={styles.vAmt}>{t.vat}</Text>
                                    <Text style={styles.vAmt}>{t.gross}</Text>
                                </View>
                                {vatSummary.map((v) => (
                                    <View key={`${v.vatRate}|${v.vatType}|${v.vatLabel ?? ""}`} style={styles.vatRow}>
                                        <Text style={styles.vRate}>{vatLabel(v.vatLabel, v.vatRate)}</Text>
                                        <Text style={styles.vAmt}>{money(v.netAmount)}</Text>
                                        <Text style={styles.vAmt}>{money(v.vatAmount)}</Text>
                                        <Text style={styles.vAmt}>{money(v.grossAmount)}</Text>
                                    </View>
                                ))}
                            </>
                        ) : null}
                    </View>
                    <View style={styles.totals}>
                        <View style={styles.trow}>
                            <Text>{t.totalNet}</Text>
                            <Text>{money(subtotal)}</Text>
                        </View>
                        <View style={styles.trow}>
                            <Text>{t.totalVat}</Text>
                            <Text>{money(totalVat)}</Text>
                        </View>
                        <View style={[styles.band, { backgroundColor: accent, color: onAccent }]}>
                            <Text style={styles.bandLabel}>{paid ? t.paid : t.totalDue}</Text>
                            <Text style={styles.bandValue}>{money(total)}</Text>
                        </View>
                    </View>
                </View>

                {isReverseCharge ? <Text style={[styles.notice, { color: accentText }]}>{t.reverseCharge}</Text> : null}

                {/* Payment: paid badge, or bank details + online payment link */}
                {paid ? (
                    <Text style={styles.paidBox}>
                        ✓ {t.paid}{method ? ` ${method}` : ""}
                        {cardLast4 ? ` •••• ${cardLast4}` : ""}
                        {paidAt ? ` · ${formatDate(paidAt)}` : ""}
                    </Text>
                ) : hasBankDetails || paymentUrl ? (
                    <View style={styles.section} wrap={false}>
                        <Text style={[styles.sectionLabel, { color: accentText }]}>{t.paymentDetails}</Text>
                        {hasBankDetails ? (
                            <View style={styles.payGrid}>
                                <PayCell label={t.bank} value={bankName} />
                                <PayCell label={t.iban} value={bankIban} />
                                <PayCell label={t.swift} value={bankSwift} />
                                <PayCell label={t.accountNumber} value={bankAccountNumber} />
                                <PayCell label={t.paymentReference} value={invoiceNumber} />
                            </View>
                        ) : null}
                        {paymentUrl ? (
                            <>
                                <Link src={paymentUrl} style={[styles.payButton, { backgroundColor: accent, color: onAccent }]}>
                                    {t.payOnline} →
                                </Link>
                                <Text style={styles.payUrl}>{paymentUrl}</Text>
                            </>
                        ) : null}
                    </View>
                ) : null}

                {notes ? (
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: accentText }]}>{t.notes}</Text>
                        <Text style={styles.body}>{notes}</Text>
                    </View>
                ) : null}

                {terms ? (
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: accentText }]}>{t.terms}</Text>
                        <Text style={styles.body}>{terms}</Text>
                    </View>
                ) : null}

                {legalNotes && legalNotes.length > 0 ? (
                    <View style={styles.legalBox} wrap={false}>
                        {legalNotes.map((note, i) => <Text key={i} style={styles.legal}>{note}</Text>)}
                    </View>
                ) : null}

                <View style={styles.footer} fixed>
                    <Text>{[brandDisplayName || sellerName, sellerEmail].filter(Boolean).join(" · ")}</Text>
                </View>
                {/* Separate element: a `render` Text inside the fixed footer View blanks the whole footer */}
                <Text style={styles.pageNumber} fixed render={({ pageNumber, totalPages }) => `${t.page} ${pageNumber} / ${totalPages}`} />
            </Page>
        </Document>
    )
}
