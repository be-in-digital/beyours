/**
 * GPT-3.5 powered automatic translation
 * @packageDocumentation
 */

import { z } from 'zod'
import type { Locale, TranslatedItem, HttpClient } from './types'

const translateTextInputSchema = z.object({
  text: z.string().min(1),
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  context: z.string().optional(),
})

const batchTranslateInputSchema = z.object({
  items: z.array(z.object({ text: z.string().min(1), key: z.string().optional() })),
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
})

/**
 * OpenAI API response structure
 */
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    total_tokens: number
  }
}

/**
 * Estimate translation cost based on text length
 *
 * GPT-3.5-turbo pricing (as of 2024):
 * - Input: $0.0005 per 1K tokens
 * - Output: $0.0015 per 1K tokens
 * - Rough estimate: 1 char ≈ 0.25 tokens
 *
 * @param textLength - Length of text to translate
 * @returns Estimated cost in USD
 */
export function estimateTranslationCost(textLength: number): number {
  // Estimate tokens (chars * 0.25)
  const estimatedInputTokens = textLength * 0.25
  // Output is roughly same length
  const estimatedOutputTokens = estimatedInputTokens
  const totalTokens = estimatedInputTokens + estimatedOutputTokens

  // Calculate cost
  const inputCost = (estimatedInputTokens / 1000) * 0.0005
  const outputCost = (estimatedOutputTokens / 1000) * 0.0015

  return inputCost + outputCost
}

/**
 * Create a system prompt for translation
 */
function createTranslationPrompt(
  text: string,
  sourceLang: Locale,
  targetLang: Locale,
  context?: string
): string {
  let prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translated text, without any explanation or additional content.`

  if (context) {
    prompt += ` Context: ${context}.`
  }

  prompt += `\n\nText to translate:\n${text}`

  return prompt
}

/**
 * Delay helper for retry logic
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Translate text using GPT-3.5-turbo
 *
 * @param text - Text to translate
 * @param sourceLang - Source language code
 * @param targetLang - Target language code
 * @param context - Optional context for better translation (e.g., "product name", "menu item")
 * @param httpClient - HTTP client for API calls
 * @param apiKey - OpenAI API key
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Translated text
 *
 * @example
 * ```typescript
 * const translated = await translateText(
 *   'Bonjour le monde',
 *   'fr',
 *   'en',
 *   'greeting',
 *   httpClient,
 *   'sk-...'
 * )
 * // "Hello world"
 * ```
 */
export async function translateText(
  text: string,
  sourceLang: Locale,
  targetLang: Locale,
  context?: string,
  httpClient?: HttpClient,
  apiKey?: string,
  maxRetries = 3
): Promise<string> {
  // Validate inputs
  const result = translateTextInputSchema.safeParse({
    text,
    sourceLang,
    targetLang,
    context,
  })

  if (!result.success) {
    throw new Error(`Invalid translation input: ${result.error.message}`)
  }

  if (!httpClient) {
    throw new Error('HTTP client is required for translation')
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required for translation')
  }

  const prompt = createTranslationPrompt(text, sourceLang, targetLang, context)

  // Retry logic with exponential backoff
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await httpClient.post<OpenAIResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent translations
          max_tokens: Math.ceil(text.length * 2), // Rough estimate
        },
        {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
      )

      const translated = response.choices[0]?.message?.content?.trim()

      if (!translated) {
        throw new Error('Empty translation response')
      }

      return translated
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on auth errors
      if (lastError.message.includes('401') || lastError.message.includes('authentication')) {
        throw lastError
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        await delay(1000 * Math.pow(2, attempt))
      }
    }
  }

  throw lastError || new Error('Translation failed after retries')
}

/**
 * Batch translate multiple items
 *
 * Includes rate limiting (max 60 requests per minute)
 *
 * @param items - Items to translate (array of { text, key? })
 * @param sourceLang - Source language code
 * @param targetLang - Target language code
 * @param httpClient - HTTP client for API calls
 * @param apiKey - OpenAI API key
 * @param rateLimit - Max requests per minute (default: 60)
 * @returns Array of translated items with costs
 *
 * @example
 * ```typescript
 * const items = [
 *   { text: 'Bonjour', key: 'greeting' },
 *   { text: 'Au revoir', key: 'goodbye' }
 * ]
 *
 * const translated = await batchTranslate(items, 'fr', 'en', httpClient, 'sk-...')
 * // [
 * //   { original: 'Bonjour', translated: 'Hello', locale: 'en', cost: 0.000015 },
 * //   { original: 'Au revoir', translated: 'Goodbye', locale: 'en', cost: 0.000018 }
 * // ]
 * ```
 */
export async function batchTranslate(
  items: Array<{ text: string; key?: string }>,
  sourceLang: Locale,
  targetLang: Locale,
  httpClient: HttpClient,
  apiKey: string,
  rateLimit = 60
): Promise<TranslatedItem[]> {
  // Validate inputs
  const result = batchTranslateInputSchema.safeParse({
    items,
    sourceLang,
    targetLang,
  })

  if (!result.success) {
    throw new Error(`Invalid batch translate input: ${result.error.message}`)
  }

  const results: TranslatedItem[] = []
  const delayBetweenRequests = Math.ceil(60000 / rateLimit) // ms between requests

  for (const item of items) {
    try {
      const translated = await translateText(
        item.text,
        sourceLang,
        targetLang,
        item.key,
        httpClient,
        apiKey
      )

      const cost = estimateTranslationCost(item.text.length)

      results.push({
        original: item.text,
        translated,
        locale: targetLang,
        cost,
      })

      // Rate limiting: wait between requests
      if (results.length < items.length) {
        await delay(delayBetweenRequests)
      }
    } catch (error) {
      // Log error but continue with other items
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[i18n] Failed to translate "${item.text}":`, error)
      }

      // Add failed item with original text
      results.push({
        original: item.text,
        translated: item.text, // Keep original on failure
        locale: targetLang,
        cost: 0,
      })
    }
  }

  return results
}

/**
 * Calculate total cost for a batch of translations
 *
 * @param results - Translated items
 * @returns Total cost in USD
 */
export function calculateTotalCost(results: TranslatedItem[]): number {
  return results.reduce((total, item) => total + item.cost, 0)
}

/**
 * Group translation results by success/failure
 *
 * @param results - Translated items
 * @returns Object with successful and failed translations
 */
export function groupTranslationResults(results: TranslatedItem[]): {
  successful: TranslatedItem[]
  failed: TranslatedItem[]
} {
  const successful = results.filter((r) => r.translated !== r.original)
  const failed = results.filter((r) => r.translated === r.original && r.cost === 0)

  return { successful, failed }
}
