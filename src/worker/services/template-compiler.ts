import { Context, Effect, Layer } from "effect"
import { PdfRenderError } from "../../shared/errors/index.js"
import { InvoicePropsType } from "../../templates/types.js"
import React from "react"
import { LRUCache } from "lru-cache"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as crypto from "node:crypto"

export class TemplateCompilerService extends Context.Tag("TemplateCompilerService")<
    TemplateCompilerService,
    {
        readonly compile: (
            templateId: string,
            version: number,
            sourceCode: string
        ) => Effect.Effect<React.ComponentType<InvoicePropsType>, PdfRenderError>
    }
>() { }

const createTemplateCompilerService = Effect.gen(function* () {
    const cache = new LRUCache<string, React.ComponentType<InvoicePropsType>>({
        max: 100, // keep up to 100 compiled templates in memory
    })

    // We need to polyfill/provide dependencies for the compiled component
    // Specifically, it will need react and @react-pdf/renderer
    const transpiler = new Bun.Transpiler({
        loader: "tsx",
        target: "node",
    })

    return {
        compile: (templateId, version, sourceCode) =>
            Effect.tryPromise({
                try: async () => {
                    const cacheKey = `${templateId}:${version}`
                    if (cache.has(cacheKey)) {
                        return cache.get(cacheKey)!
                    }

                    // Transpile TSX to JS
                    const jsCode = await transpiler.transform(sourceCode)

                    // We write the compiled JS to a temp file and dynamically import it
                    // This allows Node/Bun to resolve the imports seamlessly
                    const hash = crypto.createHash("md5").update(jsCode).digest("hex")
                    const tmpFileName = `compiled-template-${templateId}-${hash}.mjs`
                    const tmpFilePath = path.join(process.cwd(), "node_modules", ".cache", tmpFileName)

                    await fs.mkdir(path.dirname(tmpFilePath), { recursive: true })
                    await fs.writeFile(tmpFilePath, jsCode, "utf-8")

                    // Dynamically import
                    const module = await import(pathToFileURL(tmpFilePath).href)

                    const Component = module.default

                    if (!Component) {
                        throw new Error("Template must default export a React component")
                    }

                    cache.set(cacheKey, Component)

                    // Cleanup tmp file asynchronously
                    fs.unlink(tmpFilePath).catch(() => { })

                    return Component as React.ComponentType<InvoicePropsType>
                },
                catch: (cause) => new PdfRenderError({ message: "Failed to compile TSX template", cause }),
            }),
    }
})

// helper to safely convert paths to URL for dynamic import (works across platforms)
import { pathToFileURL } from "node:url"

export const TemplateCompilerServiceLive = Layer.effect(
    TemplateCompilerService,
    createTemplateCompilerService
)
