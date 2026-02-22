import { BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { WorkersLive } from "./layers/index.js"
import { LoggerService } from "../shared/services/logger.js"

const App = Effect.gen(function* () {
    const logger = yield* LoggerService
    yield* logger.info("Worker process started successfully, listening for jobs...")

    // Keep the process alive
    yield* Effect.never
})

BunRuntime.runMain(Layer.launch(App.pipe(Layer.provide(WorkersLive))))
