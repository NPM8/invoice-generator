// Workerd-compatible drop-in for "yoga-layout/load" (what @react-pdf/layout imports).
//
// yoga-layout 3.x instantiates its WASM from embedded base64 at runtime
// (WebAssembly.instantiate(bytes)), which the Workers runtime forbids
// ("Wasm code generation disallowed by embedder"). Here we import the yoga
// .wasm as a STATIC module (workerd precompiles it at deploy) and feed it to
// emscripten via the `instantiateWasm` hook, so only instantiate(MODULE,...)
// runs at request time — which workerd allows.
//
// Aliased in via wrangler.invoice.toml [alias]; relative paths dodge the
// yoga-layout package `exports` map. Bun tests don't use the alias (they run
// the stock WASM loader, which works under Node/Bun).

// @ts-expect-error untyped emscripten module
import loadYogaImpl from "../../node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js"
import wrapAssembly from "../../node_modules/yoga-layout/dist/src/wrapAssembly.js"
import yogaModule from "./yoga.wasm"

export async function loadYoga() {
    const instance = await loadYogaImpl({
        instantiateWasm(
            imports: WebAssembly.Imports,
            success: (inst: WebAssembly.Instance, mod: WebAssembly.Module) => void,
        ) {
            WebAssembly.instantiate(yogaModule, imports).then((inst) => success(inst, yogaModule))
            return {}
        },
    })
    return wrapAssembly(instance)
}

export * from "../../node_modules/yoga-layout/dist/src/generated/YGEnums.js"
