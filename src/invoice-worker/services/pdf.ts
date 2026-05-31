import { Context, Effect, Layer } from "effect"
import { pdf, type DocumentProps } from "@react-pdf/renderer"
import { PdfRenderError } from "../../shared/errors/index.js"
import React from "react"
import type { InvoicePropsType } from "../../templates/types.js"

export class PdfService extends Context.Tag("PdfService")<
    PdfService,
    {
        readonly renderToBuffer: (
            Component: React.ComponentType<InvoicePropsType>,
            props: InvoicePropsType
        ) => Effect.Effect<Uint8Array, PdfRenderError>
    }
>() { }

const createPdfService = Effect.succeed({
    renderToBuffer: (Component: React.ComponentType<InvoicePropsType>, props: InvoicePropsType) =>
        Effect.tryPromise({
            try: async () => {
                // Template components render a react-pdf <Document> root; createElement
                // types it by the component's props, so re-type to the renderer's
                // expected Document element using react-pdf's public DocumentProps type.
                const doc = React.createElement(Component, props) as React.ReactElement<DocumentProps>
                // pdf().toBlob() works in both the Node and browser builds; the
                // worker aliases @react-pdf/renderer to the browser build (renderToBuffer
                // is Node-only and throws on workerd). See wrangler.invoice.toml [alias].
                const blob = await pdf(doc).toBlob()
                return new Uint8Array(await blob.arrayBuffer())
            },
            catch: (cause) => new PdfRenderError({ message: "Failed to render PDF to buffer", cause }),
        }),
})

export const PdfServiceLive = Layer.effect(PdfService, createPdfService)
