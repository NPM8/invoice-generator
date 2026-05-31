import type { ComponentType } from "react"
import type { InvoicePropsType } from "./types.js"
import DefaultInvoice from "./components/default-invoice.js"
import MinimalInvoice from "./components/minimal-invoice.js"

// Bundled PDF templates, keyed by the invoice_templates.name used to select them.
// These are compiled into the worker bundle (no runtime TSX compilation, which
// cannot run on the Cloudflare Workers runtime — see template-compiler TODO).
//
// To add a template: create the component under components/, import it here, add
// an entry, then create an invoice_templates row whose `name` matches the key
// (use it via the invoice's templateId, or mark it is_default).
export const BUNDLED_TEMPLATES: Record<string, ComponentType<InvoicePropsType>> = {
    "default-invoice": DefaultInvoice,
    "minimal": MinimalInvoice,
}

/** Resolve a template row's component by name; unknown names fall back to the default. */
export function resolveTemplateComponent(name: string): ComponentType<InvoicePropsType> {
    return BUNDLED_TEMPLATES[name] ?? DefaultInvoice
}
