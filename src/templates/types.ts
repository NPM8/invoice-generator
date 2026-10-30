export interface InvoicePropsType {
    invoiceId: string
    invoiceNumber: string
    orgId: string

    // Seller Snapshot
    sellerName: string
    sellerAddress: string
    sellerCompanyRegistrationNumber?: string | null
    sellerLocalTaxId?: string | null
    sellerRegistrationDetails?: string | null
    sellerTaxId?: string | null
    sellerTaxIdType?: string | null
    sellerCountryCode: string
    sellerEmail?: string | null

    // Buyer
    buyerName: string
    buyerAddress?: string | null
    buyerTaxId?: string | null
    buyerTaxIdType?: string | null
    buyerCountryCode: string
    buyerEmail?: string | null

    // Financials
    currency: string
    subtotal: number
    totalVat: number
    total: number
    vatSummary: Array<{
        vatRate: number
        vatType: string
        netAmount: number
        vatAmount: number
        grossAmount: number
        vatLabel?: string | null
    }>
    isReverseCharge: boolean

    // Items
    items: Array<{
        position: number
        description: string
        quantity: number
        unit: string
        unitPrice: number
        discountPercent: number
        vatRate: number
        vatAmount: number
        netAmount: number
        grossAmount: number
        vatLabel?: string | null
    }>

    // Dates
    issueDate: string
    dueDate: string

    // Payment (recorded — e.g. paid by card at checkout in the calling app)
    paymentStatus: string // "paid" | "unpaid"
    paymentMethod?: string | null // "card" | "bank_transfer" | "cash" | "other"
    paidAt?: string | null
    cardLast4?: string | null

    // Org branding & payment info
    logoUrl?: string | null
    bankName?: string | null
    bankIban?: string | null
    bankSwift?: string | null
    bankAccountNumber?: string | null

    // Platform mode (per-invoice branding / language / payment link)
    locale?: string | null // "en" | "pl" | "de" | "cs" | "sk"; null => sk-SK formatting
    accentColor?: string | null // "#rrggbb"
    brandDisplayName?: string | null
    paymentUrl?: string | null
    legalNotes?: ReadonlyArray<string> | null

    // Extra
    notes?: string | null
    terms?: string | null
    metadata?: any

    // Helpers embedded at runtime for formatting
    helpers: {
        formatCurrency: (amount: number, currencyCode?: string) => string
        formatDate: (dateString: string) => string
        formatNumber?: (value: number) => string
    }
}
