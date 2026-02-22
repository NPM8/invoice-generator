import { describe, it, expect } from "bun:test"
import * as crypto from "node:crypto"

describe("API Key Hashing", () => {
    const hashKey = (key: string) => crypto.createHash("sha256").update(key).digest("hex")

    it("generates and verifies key hashes correctly", () => {
        const rawKey = `inv_${crypto.randomUUID().replace(/-/g, "")}`
        const keyPrefix = rawKey.substring(0, 8)
        const keyHash = hashKey(rawKey)

        expect(rawKey.startsWith("inv_")).toBe(true)
        expect(keyPrefix.startsWith("inv_")).toBe(true)

        const providedHash = hashKey(rawKey)
        const isMatch = crypto.timingSafeEqual(
            Buffer.from(providedHash, 'hex'),
            Buffer.from(keyHash, 'hex')
        )

        expect(isMatch).toBe(true)
    })

    it("fails verification for wrong key", () => {
        const rawKey = `inv_${crypto.randomUUID().replace(/-/g, "")}`
        const wrongKey = `inv_${crypto.randomUUID().replace(/-/g, "")}`

        const keyHash = hashKey(rawKey)
        const providedHash = hashKey(wrongKey)

        const isMatch = crypto.timingSafeEqual(
            Buffer.from(providedHash, 'hex'),
            Buffer.from(keyHash, 'hex')
        )

        expect(isMatch).toBe(false)
    })
})
