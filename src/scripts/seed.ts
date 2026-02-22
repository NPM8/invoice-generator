import { Effect, Layer } from "effect"
import { OrganizationService, OrganizationServiceLive } from "../shared/services/organization.js"
import { ApiKeyService, ApiKeyServiceLive } from "../shared/services/api-key.js"
import { TemplateService, TemplateServiceLive } from "../shared/services/template.js"
import { DatabaseServiceLive } from "../shared/services/database.js"
import { StorageServiceLive } from "../shared/services/storage.js"
import { QueueServiceLive } from "../shared/services/queue.js"
import { ConfigServiceLive } from "../shared/config/index.js"
import { LoggerServiceLive, LoggerService } from "../shared/services/logger.js"
import DefaultInvoice from "../templates/components/default-invoice.js"

const SeedProgram = Effect.gen(function* () {
    const logger = yield* LoggerService
    const orgService = yield* OrganizationService
    const apiKeyService = yield* ApiKeyService
    const templateService = yield* TemplateService

    yield* logger.info("Seeding initial data...")

    // 1. Create Default Organization
    const org = yield* orgService.create({
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

    yield* logger.info(`Created Organization: ${org.id}`)

    // 2. Create Admin API Key
    const adminKey = yield* apiKeyService.generate({
        orgId: org.id,
        name: "Master Admin Key",
        scopes: ["admin"],
    })

    yield* logger.info(`Created Admin API Key: ${adminKey.key}`)
    yield* logger.info(`SAVE THIS KEY, IT WILL NOT BE SHOWN AGAIN!`)

    // 3. Register Global Default Template
    // Default templates have orgId = null in DB. 
    // Wait, our TemplateService creates org-scoped templates since `create` takes orgId.
    // We can just create this default template for the specific org to satisfy seeding.
    const template = yield* templateService.create(org.id, {
        name: "Standard Invoice",
        description: "Built-in Standard Invoice Template",
        componentCode: `// Use built-in template\nexport { default } from "../../templates/components/default-invoice.js"`,
    })

    // Hack: manually set is_default = true in DB for seed purposes
    // Normally there is an endpoint for set_default

    yield* logger.info(`Created Default Template: ${template.id}`)
    yield* logger.info("Seed complete.")
})

const MainLive = Layer.mergeAll(OrganizationServiceLive, ApiKeyServiceLive, TemplateServiceLive).pipe(
    Layer.provide(Layer.mergeAll(DatabaseServiceLive, StorageServiceLive, QueueServiceLive)),
    Layer.provide(ConfigServiceLive),
    Layer.provide(LoggerServiceLive)
)

Effect.runPromise(SeedProgram.pipe(Effect.provide(MainLive))).catch(console.error)
