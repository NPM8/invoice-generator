import { Context, Effect, Layer } from "effect"
import { renderToBuffer } from "@react-pdf/renderer"
import { PdfRenderError } from "../../shared/errors/index.js"
import React from "react"
import { InvoicePropsType } from "../../templates/types.js"

export class PdfService extends Context.Tag("PdfService")<
    PdfService,
    {
        readonly renderToBuffer: (
            Component: React.ComponentType<InvoicePropsType>,
            props: InvoicePropsType
        ) => Effect.Effect<Buffer, PdfRenderError>
    }
>() { }

const createPdfService = Effect.succeed({
    renderToBuffer: (Component, props) =>
        Effect.tryPromise({
            try: async () => {
                const doc = React.createElement(Component, props)
                const buffer = await renderToBuffer(doc)
                return Buffer.from(buffer)
            },
            catch: (cause) => new PdfRenderError({ message: "Failed to render PDF to buffer", cause }),
        }),
})

export const PdfServiceLive = Layer.effect(PdfService, createPdfService)
