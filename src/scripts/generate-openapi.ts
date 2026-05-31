// Generates openapi.json from the Effect HttpApi definition.
// Run: bun run generate-openapi   (writes ./openapi.json)

import { OpenApi } from "@effect/platform"
import { InvoicingApi } from "../api-worker/api.js"

const spec = OpenApi.fromApi(InvoicingApi)
await Bun.write("openapi.json", JSON.stringify(spec, null, 2))
console.log("Wrote openapi.json")
