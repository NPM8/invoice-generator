import type { ComponentType } from "react"
import type { InvoicePropsType } from "./types.js"
import type { TemplateName } from "../shared/schemas/common.js"
import DefaultInvoice from "./components/default-invoice.js"
import MinimalInvoice from "./components/minimal-invoice.js"
import BekimMinimal from "./components/bekim-minimal.js"
import Brand from "./components/brand.js"

// Bundled PDF templates, keyed by the invoice_templates.name used to select them.
// These are compiled into the worker bundle (no runtime TSX compilation, which
// cannot run on the Cloudflare Workers runtime — see template-compiler TODO).
//
// To add a template: create the component under components/, import it here, add
// an entry AND its key to `TemplateName` (src/shared/schemas/common.ts — the API
// validates `templateName` against it), then either pass `templateName` when
// creating an invoice or create an invoice_templates row whose `name` matches the
// key (use it via the invoice's templateId, or mark it is_default).
export const BUNDLED_TEMPLATES: Record<TemplateName, ComponentType<InvoicePropsType>> = {
    "default-invoice": DefaultInvoice,
    "minimal": MinimalInvoice,
    "bekim-minimal": BekimMinimal,
    "brand": Brand,
}

/** Resolve a template row's component by name; unknown names fall back to bekim-minimal (the default design). */
export function resolveTemplateComponent(name: string): ComponentType<InvoicePropsType> {
    return BUNDLED_TEMPLATES[name as TemplateName] ?? BekimMinimal
}
