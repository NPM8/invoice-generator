import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { Layer } from "effect"
import { makeCoreLayer } from "./layers/index.js"
import type { Env } from "../shared/types/env.js"

let cachedHandler: ((request: Request) => Promise<Response>) | null = null

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (!cachedHandler) {
            const { handler } = HttpApiBuilder.toWebHandler(
                Layer.mergeAll(makeCoreLayer(env), HttpServer.layerContext),
                { middleware: HttpMiddleware.cors() }
            )
            cachedHandler = handler
        }
        return cachedHandler(request)
    },
}
