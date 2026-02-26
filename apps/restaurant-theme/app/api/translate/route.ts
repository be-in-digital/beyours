import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { translateText, batchTranslate } from "@beindigital-engine/core"
import { isAuthenticated } from "@/lib/convex"

/**
 * Simple fetch-based HTTP client compatible with the core translateText signature.
 */
const httpClient = {
  post: async <T>(url: string, body: unknown, headers: Record<string, string>): Promise<T> => {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    return response.json() as Promise<T>
  },
}

/**
 * POST /api/translate
 *
 * Body:
 *   Single: { text, sourceLang, targetLang, context? }
 *   Batch:  { items: [{ text, key? }], sourceLang, targetLang }
 *
 * NOTE: Bulk UI string translation is handled by the Convex action
 * `autoTranslate.translateUIStrings` — NOT this route.
 *
 * Requires OPENAI_API_KEY env var.
 */
export async function POST(request: Request) {
  // Auth check — prevent unauthenticated API cost exploitation
  const authed = await isAuthenticated(await headers())
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Translation service not configured" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()

    // Batch mode
    if (Array.isArray(body.items)) {
      const { items, sourceLang, targetLang } = body

      if (!items?.length || !sourceLang || !targetLang) {
        return NextResponse.json(
          { error: "Missing required fields: items, sourceLang, targetLang" },
          { status: 400 }
        )
      }

      const results = await batchTranslate(
        items,
        sourceLang,
        targetLang,
        httpClient,
        apiKey
      )

      return NextResponse.json({ results })
    }

    // Single mode
    const { text, sourceLang, targetLang, context } = body

    if (!text || !sourceLang || !targetLang) {
      return NextResponse.json(
        { error: "Missing required fields: text, sourceLang, targetLang" },
        { status: 400 }
      )
    }

    const translated = await translateText(
      text,
      sourceLang,
      targetLang,
      context,
      httpClient,
      apiKey
    )

    return NextResponse.json({ translated })
  } catch (error) {
    console.error("[translate] Error:", error)
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    )
  }
}
