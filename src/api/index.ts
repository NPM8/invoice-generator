import { HttpApiMiddleware, HttpApiBuilder } from "@effect/platform"
import { HttpApiScalar, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { InvoicingApi } from "./api.js"
import { CoreLayer } from "./layers/index.js"
import { ConfigService } from "../shared/config/index.js"

const ServerLive = BunHttpServer.layerConfig(
    Effect.gen(function* () {
        const config = yield* ConfigService
        return { port: config.apiPort }
    })
)

const App = HttpApiBuilder.serve(HttpApiMiddleware.cors()).pipe(
    Layer.provide(HttpApiScalar.layer()),
    Layer.provide(CoreLayer),
    Layer.provide(ServerLive)
)

BunRuntime.runMain(Layer.launch(App))
