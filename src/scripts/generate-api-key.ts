import { Effect, Layer } from "effect"
import { ApiKeyService, ApiKeyServiceLive } from "../shared/services/api-key.js"
import { DatabaseServiceLive } from "../shared/services/database.js"
import { ConfigServiceLive } from "../shared/config/index.js"
import { parseArgs } from "util"

const GenerateProgram = Effect.gen(function* () {
    const { values } = parseArgs({
        args: Bun.argv,
        options: {
            "org-id": {
                type: "string",
            },
            name: {
                type: "string",
            },
            admin: {
                type: "boolean",
            },
        },
        strict: true,
        allowPositionals: true,
    })

    if (!values["org-id"]) {
        console.error("Usage: bun generate-api-key.ts --org-id <uuid> [--name <name>] [--admin]")
        process.exit(1)
    }

    const apiKeyService = yield* ApiKeyService

    const keyResult = yield* apiKeyService.generate({
        orgId: values["org-id"],
        name: values.name || "CLI Generated Key",
        scopes: values.admin ? ["admin"] : [],
    })

    console.log(`\nAPI Key Generated successfully!`)
    console.log(`Key Name: ${keyResult.name}`)
    console.log(`Scopes:   ${keyResult.scopes.join(", ")}`)
    console.log(`Key Hash: ${keyResult.keyHash}`)
    console.log(`\nSECRET KEY: ${keyResult.key}`)
    console.log(`\nImportant: Save the secret key. It will not be shown again.`)
})

const MainLive = ApiKeyServiceLive.pipe(
    Layer.provide(DatabaseServiceLive),
    Layer.provide(ConfigServiceLive)
)

Effect.runPromise(GenerateProgram.pipe(Effect.provide(MainLive))).catch(console.error)
