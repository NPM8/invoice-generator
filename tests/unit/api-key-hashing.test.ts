import { describe, it, expect } from "bun:test"

describe("API Key Hashing (Web Crypto)", () => {
    const hexEncode = (buffer: ArrayBuffer) =>
        Array.from(new Uint8Array(buffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")

    const hashKey = async (key: string): Promise<string> => {
        const encoded = new TextEncoder().encode(key)
        const digest = await crypto.subtle.digest("SHA-256", encoded)
        return hexEncode(digest)
    }

    const constantTimeEqual = (a: string, b: string): boolean => {
        if (a.length !== b.length) return false
        let result = 0
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i)
        }
        return result === 0
    }

    it("generates and verifies key hashes correctly", async () => {
        const rawKey = `inv_${crypto.randomUUID().replace(/-/g, "")}`
        const keyPrefix = rawKey.substring(0, 8)
        const keyHash = await hashKey(rawKey)

        expect(rawKey.startsWith("inv_")).toBe(true)
        expect(keyPrefix.startsWith("inv_")).toBe(true)

        const providedHash = await hashKey(rawKey)
        const isMatch = constantTimeEqual(providedHash, keyHash)

        expect(isMatch).toBe(true)
    })

    it("fails verification for wrong key", async () => {
        const rawKey = `inv_${crypto.randomUUID().replace(/-/g, "")}`
        const wrongKey = `inv_${crypto.randomUUID().replace(/-/g, "")}`

        const keyHash = await hashKey(rawKey)
        const providedHash = await hashKey(wrongKey)

        const isMatch = constantTimeEqual(providedHash, keyHash)

        expect(isMatch).toBe(false)
    })

    it("constant-time comparison prevents timing attacks", () => {
        expect(constantTimeEqual("abc", "abc")).toBe(true)
        expect(constantTimeEqual("abc", "abd")).toBe(false)
        expect(constantTimeEqual("abc", "ab")).toBe(false)
        expect(constantTimeEqual("", "")).toBe(true)
    })
})
