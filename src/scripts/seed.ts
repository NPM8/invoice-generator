import { Effect, Layer, Schema } from "effect"
import { OrganizationService, OrganizationServiceLive } from "../shared/services/organization.js"
import { ApiKeyService, ApiKeyServiceLive } from "../shared/services/api-key.js"
import { TemplateService, TemplateServiceLive } from "../shared/services/template.js"
import { DatabaseServiceLive } from "../shared/services/database.js"
import { makeConfigServiceFromEnv } from "../shared/config/index.js"
import { LoggerServiceLive, LoggerService } from "../shared/services/logger.js"
import { CreateOrganization } from "../shared/schemas/organization.js"

const SeedProgram = Effect.gen(function* () {
    const logger = yield* LoggerService
    const orgService = yield* OrganizationService
    const apiKeyService = yield* ApiKeyService
    const templateService = yield* TemplateService

    yield* logger.info("Seeding initial data...")

    // 1. Create Default Organization
    const org = yield* orgService.create(
        Schema.decodeSync(CreateOrganization)({
            name: "Acme Corp",
            legalName: "Acme Corporation Inc.",
            addressLine1: "123 Innovation Way",
            city: "San Francisco",
            state: "CA",
            postalCode: "94107",
            countryCode: "US",
            taxId: "US123456789",
            taxIdType: "us_ein",
            defaultCurrency: "USD",
        })
    )

    yield* logger.info(`Created Organization: ${org.id}`)

    // 2. Create Admin API Key
    const adminKey = yield* apiKeyService.generate({
        orgId: org.id,
        name: "Master Admin Key",
        scopes: ["admin"],
    })

    yield* logger.info(`Created Admin API Key: ${adminKey.key}`)
    yield* logger.info(`SAVE THIS KEY, IT WILL NOT BE SHOWN AGAIN!`)

    // 3. Register Default Template
    const template = yield* templateService.create(org.id, {
        name: "Standard Invoice",
        description: "Built-in Standard Invoice Template",
        componentCode: `// Use built-in template\nexport { default } from "../../templates/components/default-invoice.js"`,
    })

    yield* logger.info(`Created Default Template: ${template.id}`)
    yield* logger.info("Seed complete.")
})

const env = {
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    ADMIN_API_KEY: process.env.ADMIN_API_KEY || "",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    NODE_ENV: process.env.NODE_ENV || "development",
}

const MainLive = Layer.mergeAll(
    OrganizationServiceLive,
    ApiKeyServiceLive,
    TemplateServiceLive,
    LoggerServiceLive
).pipe(
    Layer.provide(DatabaseServiceLive),
    Layer.provide(makeConfigServiceFromEnv(env)),
    Layer.provide(LoggerServiceLive)
)

Effect.runPromise(SeedProgram.pipe(Effect.provide(MainLive))).catch(console.error)
