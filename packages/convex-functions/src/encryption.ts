/**
 * Encryption utilities for securing OAuth tokens stored in Convex.
 *
 * Uses AES-256-GCM with a unique random IV per encryption.
 * Intended for use inside Convex "use node" actions where the
 * Node.js `crypto` module is available.
 *
 * Storage format: "base64iv:base64authTag:base64ciphertext"
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 12 bytes, standard for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Read and validate the encryption key from the environment.
 * The key must be a 64-character hex string (32 bytes).
 */
function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error("ENCRYPTION_KEY environment variable is required")
  }

  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    )
  }

  return Buffer.from(hex, "hex")
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Generates a unique random 12-byte IV for each call, ensuring that
 * identical plaintexts produce different ciphertexts.
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted payload in the format "base64iv:base64authTag:base64ciphertext"
 * @throws If ENCRYPTION_KEY is missing or invalid
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":")
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 *
 * @param encrypted - Encrypted payload in the format "base64iv:base64authTag:base64ciphertext"
 * @returns The original plaintext string
 * @throws If ENCRYPTION_KEY is missing/invalid, or the payload is malformed/tampered
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey()

  const parts = encrypted.split(":")
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted payload: expected format 'base64iv:base64authTag:base64ciphertext'"
    )
  }

  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string]
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const ciphertext = Buffer.from(ciphertextB64, "base64")

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`)
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`
    )
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
