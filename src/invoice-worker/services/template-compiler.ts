import { Context, Effect, Layer } from "effect"
import { PdfRenderError } from "../../shared/errors/index.js"
import type { InvoicePropsType } from "../../templates/types.js"
import React from "react"
import * as esbuild from "esbuild"

export class TemplateCompilerService extends Context.Tag("TemplateCompilerService")<
    TemplateCompilerService,
    {
        readonly compile: (
            templateId: string,
            version: number,
            sourceCode: string,
            compiledCode?: string | null
        ) => Effect.Effect<React.ComponentType<InvoicePropsType>, PdfRenderError>
    }
>() { }

const cache = new Map<string, React.ComponentType<InvoicePropsType>>()

export const compileTemplateCode = async (sourceCode: string): Promise<string> => {
    const result = await esbuild.transform(sourceCode, {
        loader: "tsx",
        format: "esm",
        target: "esnext",
        jsx: "automatic",
        jsxImportSource: "react",
    })
    return result.code
}

const createTemplateCompilerService = Effect.succeed({
    compile: (
        templateId: string,
        version: number,
        sourceCode: string,
        compiledCode?: string | null
    ) =>
        Effect.tryPromise({
            try: async () => {
                const cacheKey = `${templateId}:${version}`
                const cached = cache.get(cacheKey)
                if (cached) return cached

                // TODO(workers): Runtime evaluation of arbitrary user-supplied template
                // modules is not possible on Cloudflare Workers. The previous
                // implementation used `URL.createObjectURL` + dynamic `import()` of a
                // blob URL, but neither `URL.createObjectURL` nor `eval`/`new Function`
                // exist in the Workers runtime (no dynamic code generation is allowed).
                //
                // A Workers-compatible path requires shipping each custom template as a
                // separately-deployed bundled module (e.g. a per-org Worker, a Durable
                // Object, or a build-time bundling step that registers components in a
                // static registry keyed by template id) rather than evaluating TSX on
                // the fly. Until that pipeline exists, only the built-in default
                // template (handled by the caller, which skips compilation for
                // `isDefault` templates) is supported.
                //
                // `compileTemplateCode` is still exported and used at template
                // create/update time (in TemplateService) to validate and persist the
                // pre-compiled JS, so the esbuild path remains exercised.
                void sourceCode
                void compiledCode
                throw new Error(
                    "Custom template runtime compilation is not supported on the Cloudflare Workers runtime; " +
                    "only the built-in default template can be rendered. See TODO(workers) in template-compiler.ts."
                )
            },
            catch: (cause) => new PdfRenderError({ message: "Failed to compile TSX template", cause }),
        }),
})

export const TemplateCompilerServiceLive = Layer.effect(
    TemplateCompilerService,
    createTemplateCompilerService
)
