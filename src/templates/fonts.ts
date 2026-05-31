import { Font } from "@react-pdf/renderer"
import { DEJAVU_SANS, DEJAVU_SANS_BOLD } from "./fonts.data.js"

// The built-in "Helvetica" uses WinAnsi encoding and lacks Latin-2 glyphs, so
// Slovak/Czech/Polish diacritics (č š ž ť ľ ď ň ô ŕ …) render blank. DejaVu Sans
// has full coverage and is embedded as base64 data URIs (see fonts.data.ts /
// `bun run generate-fonts`). The react-pdf loader decodes data: URIs in-process
// (atob), so there is NO runtime font fetch — works offline and on Workers.
export const UNICODE_FONT = "DejaVuSans"

let registered = false

/** Register the Unicode font family once (safe to call from multiple templates). */
export function registerUnicodeFont(): void {
    if (registered) return
    registered = true
    Font.register({
        family: UNICODE_FONT,
        fonts: [
            { src: DEJAVU_SANS },
            { src: DEJAVU_SANS_BOLD, fontWeight: "bold" },
        ],
    })
}
