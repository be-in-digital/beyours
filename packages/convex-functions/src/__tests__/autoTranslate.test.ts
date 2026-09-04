import { describe, it, expect, vi, afterEach } from "vitest"
import {
  parseLabelledFields,
  runTranslationPlan,
  runBatchChunkPlan,
  touchesTranslatableText,
  type TranslationPlan,
  type BatchChunkPlan,
} from "../autoTranslate"

/**
 * The pure halves of the catalogue translator (#147).
 *
 * The Convex-facing halves are pinned by `apps/*\/tests/convex/catalogue-translation.test.ts`,
 * which runs the real registrations against the real schema. What is left here
 * is the part with no `ctx`: the wire format GPT answers in, the quota stop,
 * and the rule that decides whether a write is worth translating at all.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

function gptReplying(...replies: string[]) {
  let call = 0
  const fetchMock = vi.fn(async () => {
    const content = replies[Math.min(call++, replies.length - 1)] ?? ""
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ choices: [{ message: { content } }] }),
    }
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function plan(overrides: Partial<TranslationPlan> = {}): TranslationPlan {
  return {
    sourceLang: "fr",
    sourceTexts: { name: "Pizza Margherita", description: "Tomate et basilic" },
    sourceHashes: { name: "h1", description: "h2" },
    context: "restaurant products",
    quota: { dailyLimit: 500, used: 0, resetAt: Date.now() + 3_600_000 },
    quotaWasReset: false,
    targets: [{ code: "en", fields: ["name", "description"] }],
    ...overrides,
  }
}

describe("parseLabelledFields", () => {
  it("splits a reply on the labels the prompt asked for", () => {
    const parsed = parseLabelledFields(
      "[name]: Margherita Pizza\n[description]: Tomato and basil",
      ["name", "description"]
    )
    expect(parsed).toEqual({
      name: "Margherita Pizza",
      description: "Tomato and basil",
    })
  })

  it("keeps a multi-line description in one piece", () => {
    const parsed = parseLabelledFields(
      "[name]: Margherita\n[description]: Tomato, mozzarella.\nBaked in a wood oven.",
      ["name", "description"]
    )
    expect(parsed.description).toBe("Tomato, mozzarella.\nBaked in a wood oven.")
  })

  it("drops a field the model did not answer rather than guessing", () => {
    // The alternative — writing the whole reply into the missing field —
    // would put an English paragraph into a product name.
    const parsed = parseLabelledFields("[name]: Margherita Pizza", [
      "name",
      "description",
    ])
    expect(parsed).toEqual({ name: "Margherita Pizza" })
  })
})

describe("touchesTranslatableText", () => {
  it("is true when the write carries a name or a description", () => {
    expect(touchesTranslatableText({ name: "Pizza Reine" })).toBe(true)
    expect(touchesTranslatableText({ description: "Jambon" })).toBe(true)
  })

  it("is false for a price, a stock or a status change", () => {
    // These used to book a GPT round trip and flag the document pending, for
    // a translation the planner would then find nothing to do.
    expect(touchesTranslatableText({ price: 1400 })).toBe(false)
    expect(touchesTranslatableText({ isActive: false, sortOrder: 3 })).toBe(false)
    expect(touchesTranslatableText({})).toBe(false)
  })

  it("treats an explicitly empty name as a write worth translating", () => {
    expect(touchesTranslatableText({ name: "" })).toBe(true)
  })
})

describe("runTranslationPlan", () => {
  it("makes one call per language and returns the parsed fields", async () => {
    const gpt = gptReplying(
      "[name]: Margherita Pizza\n[description]: Tomato and basil",
      "[name]: Pizza Margarita\n[description]: Tomate y albahaca"
    )

    const { results, gptCalls } = await runTranslationPlan(
      plan({
        targets: [
          { code: "en", fields: ["name", "description"] },
          { code: "es", fields: ["name", "description"] },
        ],
      }),
      "sk-test"
    )

    expect(gpt).toHaveBeenCalledTimes(2)
    expect(gptCalls).toBe(2)
    expect(results).toEqual([
      {
        languageCode: "en",
        fields: { name: "Margherita Pizza", description: "Tomato and basil" },
      },
      {
        languageCode: "es",
        fields: { name: "Pizza Margarita", description: "Tomate y albahaca" },
      },
    ])
  })

  it("stops at the daily quota instead of billing past it", async () => {
    const gpt = gptReplying("[name]: Margherita Pizza")

    const { results, gptCalls } = await runTranslationPlan(
      plan({
        quota: { dailyLimit: 1, used: 0, resetAt: Date.now() + 3_600_000 },
        targets: [
          { code: "en", fields: ["name"] },
          { code: "es", fields: ["name"] },
          { code: "de", fields: ["name"] },
        ],
      }),
      "sk-test"
    )

    expect(gpt).toHaveBeenCalledTimes(1)
    expect(gptCalls).toBe(1)
    expect(results).toHaveLength(1)
    expect(results[0]?.languageCode).toBe("en")
  })

  it("loses one language to a failure without losing the others", async () => {
    let call = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call++
        if (call === 1) {
          return { ok: false, status: 429, statusText: "Too Many Requests" }
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            choices: [{ message: { content: "[name]: Pizza Margarita" } }],
          }),
        }
      })
    )

    const { results, gptCalls } = await runTranslationPlan(
      plan({
        targets: [
          { code: "en", fields: ["name"] },
          { code: "es", fields: ["name"] },
        ],
      }),
      "sk-test"
    )

    // The failed call is still billed — it reached OpenAI.
    expect(gptCalls).toBe(1)
    expect(results).toEqual([
      { languageCode: "es", fields: { name: "Pizza Margarita" } },
    ])
  })
})

describe("runBatchChunkPlan", () => {
  function batchPlan(overrides: Partial<BatchChunkPlan> = {}): BatchChunkPlan {
    return {
      sourceLang: "fr",
      documents: [
        { documentId: "p1", texts: { name: "Pizza Margherita" } },
        { documentId: "p2", texts: { name: "Pizza Reine" } },
      ],
      emptyCount: 0,
      nextCursor: null,
      ...overrides,
    }
  }

  it("hashes what it actually translated, so the incremental pass can skip it", async () => {
    gptReplying("[name]: Margherita Pizza", "[name]: Queen Pizza")

    const { results, attempted } = await runBatchChunkPlan(
      batchPlan(),
      "en",
      "restaurant products",
      "sk-test"
    )

    expect(attempted).toBe(2)
    expect(results).toHaveLength(2)
    expect(results[0]?.fields.name).toBe("Margherita Pizza")
    // Without the hash the next incremental run would re-translate every
    // document the batch just paid for.
    expect(results[0]?.hashes.name).toEqual(expect.any(String))
    expect(results[0]?.hashes.name).not.toBe(results[1]?.hashes.name)
  })

  it("counts a failed document as attempted so the job can finish", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, statusText: "Server Error" }))
    )

    const { results, attempted } = await runBatchChunkPlan(
      batchPlan(),
      "en",
      "restaurant products",
      "sk-test"
    )

    expect(results).toHaveLength(0)
    // A progress bar that never reaches the end is worse than a partial run.
    expect(attempted).toBe(2)
  })
})
