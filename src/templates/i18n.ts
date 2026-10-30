// PDF localisation: Intl formatting per invoice locale + label dictionaries for
// templates that support multiple languages (currently `brand`). Invoices without
// a locale keep the historical sk-SK formatting.

export type TemplateLocale = "en" | "pl" | "de" | "cs" | "sk"

export const DEFAULT_LOCALE: TemplateLocale = "sk"

const INTL_LOCALES: Record<TemplateLocale, string> = {
    en: "en-GB",
    pl: "pl-PL",
    de: "de-DE",
    cs: "cs-CZ",
    sk: "sk-SK",
}

const isTemplateLocale = (locale: string | null | undefined): locale is TemplateLocale =>
    typeof locale === "string" && locale in INTL_LOCALES

export const resolveLocale = (locale: string | null | undefined): TemplateLocale =>
    isTemplateLocale(locale) ? locale : DEFAULT_LOCALE

export const intlLocale = (locale: string | null | undefined): string => INTL_LOCALES[resolveLocale(locale)]

/** Formatting helpers handed to every template (`helpers` prop). */
export const makeFormatters = (locale: string | null | undefined, defaultCurrency: string) => {
    const tag = intlLocale(locale)
    return {
        formatCurrency: (amount: number, currencyCode: string = defaultCurrency) =>
            new Intl.NumberFormat(tag, { style: "currency", currency: currencyCode }).format(amount),
        // Dates are calendar dates (YYYY-MM-DD) or UTC timestamps; Workers run in UTC.
        formatDate: (dateString: string) =>
            new Date(dateString).toLocaleDateString(tag, { timeZone: "UTC" }),
        formatNumber: (value: number) =>
            new Intl.NumberFormat(tag, { maximumFractionDigits: 4 }).format(value),
    }
}

export interface InvoiceLabels {
    invoice: string
    seller: string
    buyer: string
    issueDate: string
    dueDate: string
    description: string
    quantity: string
    unit: string
    unitPrice: string
    vatRate: string
    net: string
    vat: string
    gross: string
    vatSummary: string
    totalNet: string
    totalVat: string
    totalDue: string
    paid: string
    due: string
    paymentDetails: string
    bank: string
    iban: string
    swift: string
    accountNumber: string
    paymentReference: string
    payOnline: string
    notes: string
    terms: string
    reverseCharge: string
    taxId: string
    companyRegistrationNumber: string
    localTaxId: string
    email: string
    page: string
    paymentMethods: { card: string; bank_transfer: string; cash: string; other: string }
}

export const LABELS: Record<TemplateLocale, InvoiceLabels> = {
    en: {
        invoice: "Invoice",
        seller: "Seller",
        buyer: "Buyer",
        issueDate: "Issue date",
        dueDate: "Due date",
        description: "Description",
        quantity: "Qty",
        unit: "Unit",
        unitPrice: "Unit price",
        vatRate: "VAT",
        net: "Net",
        vat: "VAT",
        gross: "Gross",
        vatSummary: "VAT summary",
        totalNet: "Total net",
        totalVat: "Total VAT",
        totalDue: "Total due",
        paid: "Paid",
        due: "Payment due",
        paymentDetails: "Payment details",
        bank: "Bank",
        iban: "IBAN",
        swift: "SWIFT/BIC",
        accountNumber: "Account no.",
        paymentReference: "Payment reference",
        payOnline: "Pay online",
        notes: "Notes",
        terms: "Terms",
        reverseCharge: "Reverse charge: VAT to be accounted for by the recipient.",
        taxId: "VAT ID",
        companyRegistrationNumber: "Company no.",
        localTaxId: "Tax no.",
        email: "Email",
        page: "Page",
        paymentMethods: { card: "by card", bank_transfer: "by bank transfer", cash: "in cash", other: "" },
    },
    pl: {
        invoice: "Faktura",
        seller: "Sprzedawca",
        buyer: "Nabywca",
        issueDate: "Data wystawienia",
        dueDate: "Termin płatności",
        description: "Nazwa towaru lub usługi",
        quantity: "Ilość",
        unit: "J.m.",
        unitPrice: "Cena netto",
        vatRate: "Stawka VAT",
        net: "Wartość netto",
        vat: "Kwota VAT",
        gross: "Wartość brutto",
        vatSummary: "Podsumowanie VAT",
        totalNet: "Razem netto",
        totalVat: "Razem VAT",
        totalDue: "Razem do zapłaty",
        paid: "Zapłacono",
        due: "Do zapłaty",
        paymentDetails: "Dane do przelewu",
        bank: "Bank",
        iban: "IBAN",
        swift: "SWIFT/BIC",
        accountNumber: "Nr konta",
        paymentReference: "Tytuł przelewu",
        payOnline: "Zapłać online",
        notes: "Uwagi",
        terms: "Warunki",
        reverseCharge: "Odwrotne obciążenie: podatek rozlicza nabywca.",
        taxId: "NIP",
        companyRegistrationNumber: "Nr rejestrowy",
        localTaxId: "Nr podatkowy",
        email: "E-mail",
        page: "Strona",
        paymentMethods: { card: "kartą", bank_transfer: "przelewem", cash: "gotówką", other: "" },
    },
    de: {
        invoice: "Rechnung",
        seller: "Rechnungssteller",
        buyer: "Rechnungsempfänger",
        issueDate: "Rechnungsdatum",
        dueDate: "Fällig am",
        description: "Beschreibung",
        quantity: "Menge",
        unit: "Einheit",
        unitPrice: "Einzelpreis",
        vatRate: "USt.",
        net: "Netto",
        vat: "USt.",
        gross: "Brutto",
        vatSummary: "USt.-Übersicht",
        totalNet: "Summe netto",
        totalVat: "Summe USt.",
        totalDue: "Gesamtbetrag",
        paid: "Bezahlt",
        due: "Zu zahlen",
        paymentDetails: "Bankverbindung",
        bank: "Bank",
        iban: "IBAN",
        swift: "BIC",
        accountNumber: "Kontonummer",
        paymentReference: "Verwendungszweck",
        payOnline: "Online bezahlen",
        notes: "Hinweise",
        terms: "Bedingungen",
        reverseCharge: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).",
        taxId: "USt-IdNr.",
        companyRegistrationNumber: "Handelsregister",
        localTaxId: "Steuernummer",
        email: "E-Mail",
        page: "Seite",
        paymentMethods: { card: "per Karte", bank_transfer: "per Überweisung", cash: "in bar", other: "" },
    },
    cs: {
        invoice: "Faktura",
        seller: "Dodavatel",
        buyer: "Odběratel",
        issueDate: "Datum vystavení",
        dueDate: "Datum splatnosti",
        description: "Popis",
        quantity: "Množství",
        unit: "Jedn.",
        unitPrice: "Cena za jedn.",
        vatRate: "DPH",
        net: "Bez DPH",
        vat: "DPH",
        gross: "S DPH",
        vatSummary: "Rekapitulace DPH",
        totalNet: "Celkem bez DPH",
        totalVat: "DPH celkem",
        totalDue: "Celkem k úhradě",
        paid: "Zaplaceno",
        due: "K úhradě",
        paymentDetails: "Platební údaje",
        bank: "Banka",
        iban: "IBAN",
        swift: "SWIFT/BIC",
        accountNumber: "Číslo účtu",
        paymentReference: "Zpráva pro příjemce",
        payOnline: "Zaplatit online",
        notes: "Poznámky",
        terms: "Podmínky",
        reverseCharge: "Daň odvede zákazník (přenesení daňové povinnosti).",
        taxId: "DIČ",
        companyRegistrationNumber: "IČO",
        localTaxId: "Daňové číslo",
        email: "E-mail",
        page: "Strana",
        paymentMethods: { card: "kartou", bank_transfer: "převodem", cash: "v hotovosti", other: "" },
    },
    sk: {
        invoice: "Faktúra",
        seller: "Dodávateľ",
        buyer: "Odberateľ",
        issueDate: "Dátum vystavenia",
        dueDate: "Dátum splatnosti",
        description: "Popis",
        quantity: "Množstvo",
        unit: "MJ",
        unitPrice: "Jedn. cena",
        vatRate: "DPH",
        net: "Bez DPH",
        vat: "DPH",
        gross: "S DPH",
        vatSummary: "Rekapitulácia DPH",
        totalNet: "Spolu bez DPH",
        totalVat: "DPH spolu",
        totalDue: "Spolu na úhradu",
        paid: "Zaplatené",
        due: "Na úhradu",
        paymentDetails: "Platobné údaje",
        bank: "Banka",
        iban: "IBAN",
        swift: "SWIFT/BIC",
        accountNumber: "Číslo účtu",
        paymentReference: "Správa pre prijímateľa",
        payOnline: "Zaplatiť online",
        notes: "Poznámky",
        terms: "Podmienky",
        reverseCharge: "Prenesenie daňovej povinnosti: daň odvedie odberateľ.",
        taxId: "IČ DPH",
        companyRegistrationNumber: "IČO",
        localTaxId: "DIČ",
        email: "E-mail",
        page: "Strana",
        paymentMethods: { card: "kartou", bank_transfer: "prevodom", cash: "v hotovosti", other: "" },
    },
}

export const labelsFor = (locale: string | null | undefined): InvoiceLabels => LABELS[resolveLocale(locale)]
