export interface InvoicePropsType {
    invoiceId: string
    invoiceNumber: string
    orgId: string

    // Seller Snapshot
    sellerName: string
    sellerAddress: string
    sellerTaxId?: string | null
    sellerTaxIdType?: string | null
    sellerCountryCode: string

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
    }>

    // Dates
    issueDate: string
    dueDate: string

    // Org branding & payment info
    logoUrl?: string | null
    bankName?: string | null
    bankIban?: string | null
    bankSwift?: string | null
    bankAccountNumber?: string | null

    // Extra
    notes?: string | null
    terms?: string | null
    metadata?: any

    // Helpers embedded at runtime for formatting
    helpers: {
        formatCurrency: (amount: number, currencyCode?: string) => string
        formatDate: (dateString: string) => string
    }
}
