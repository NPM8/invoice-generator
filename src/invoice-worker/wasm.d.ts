// wrangler/workerd imports .wasm files as precompiled WebAssembly.Module modules.
declare module "*.wasm" {
    const module: WebAssembly.Module
    export default module
}
