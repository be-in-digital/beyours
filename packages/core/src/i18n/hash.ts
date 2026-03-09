/**
 * Source hash utilities for translation change detection
 * @packageDocumentation
 */

/**
 * Normalize text before hashing:
 * - trim whitespace
 * - collapse multiple spaces into one
 * - normalize line endings (\r\n → \n)
 */
export function normalizeText(text: string): string {
  return text.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ')
}

/**
 * Compute a stable hash from text using djb2 algorithm.
 * Used to detect changes in translatable fields and avoid
 * unnecessary re-translations.
 *
 * @param text - The source text to hash
 * @returns A hex string hash
 */
export function computeSourceHash(text: string): string {
  const normalized = normalizeText(text)
  let hash = 5381
  for (let i = 0; i < normalized.length; i++) {
    // hash * 33 + char
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0
  }
  // Convert to unsigned 32-bit then to hex
  return (hash >>> 0).toString(16)
}
