import { Font } from "@react-pdf/renderer"

// The built-in "Helvetica" uses WinAnsi encoding and lacks Latin-2 glyphs, so
// Slovak/Czech/Polish diacritics (č š ž ť ľ ď ň ô ŕ …) render blank. DejaVu Sans
// has full coverage. react-pdf fetches the TTF at render time. For production,
// consider self-hosting these (e.g. in R2) instead of relying on the CDN.
export const UNICODE_FONT = "DejaVuSans"

const BASE = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf"

let registered = false

/** Register the Unicode font family once (safe to call from multiple templates). */
export function registerUnicodeFont(): void {
    if (registered) return
    registered = true
    Font.register({
        family: UNICODE_FONT,
        fonts: [
            { src: `${BASE}/DejaVuSans.ttf` },
            { src: `${BASE}/DejaVuSans-Bold.ttf`, fontWeight: "bold" },
        ],
    })
}
