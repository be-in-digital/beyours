/**
 * `saveDraftBlockCore` cleans rich text before it reaches the table.
 *
 * The CMS editor is Tiptap and it stores `editor.getHTML()`. That string went
 * into `cmsBlocks.values` verbatim — `<script>alert(1)</script>` included —
 * which was survivable only while the storefront printed those fields as text.
 * It renders them as HTML now, so the value has to be clean on the way in as
 * well as on the way out.
 */
import { describe, it, expect, vi } from "vitest"
import { setCmsRegistry } from "@be-yours/cms"
import { saveDraftBlockCore } from "../cms"

setCmsRegistry({
  groups: [{ id: "storefront", label: "Storefront", order: 1 }],
  pages: {
    about: {
      slug: "about",
      label: "À propos",
      groupId: "storefront",
      blocks: [
        {
          key: "story",
          label: "Notre histoire",
          fields: {
            // A rich text field: markup is the point of it.
            description: {
              type: "richtext",
              label: "Description",
              maxLength: 1000,
              hasCodeFallback: true,
            },
            // A plain text field beside it: escaped on render, so its content
            // must survive untouched.
            badge: {
              type: "text",
              label: "Badge",
              maxLength: 50,
              hasCodeFallback: true,
            },
          },
        },
      ],
    },
  },
})

interface InsertedRow {
  table: string
  doc: Record<string, any>
}

interface PatchedRow {
  id: string
  patch: Record<string, any>
}

function createCtx(existingBlock?: Record<string, any>) {
  const inserted: InsertedRow[] = []
  const patched: PatchedRow[] = []

  return {
    db: {
      query: vi.fn(() => ({
        withIndex: () => ({
          unique: async () => existingBlock ?? null,
          collect: async () => [],
          filter: () => ({ collect: async () => [] }),
        }),
      })),
      insert: vi.fn(async (table: string, doc: Record<string, any>) => {
        inserted.push({ table, doc })
        return `${table}:${inserted.length}`
      }),
      patch: vi.fn(async (id: string, patch: Record<string, any>) => {
        patched.push({ id, patch })
      }),
      get: vi.fn(async () => null),
    },
    inserted,
    patched,
  }
}

function save(ctx: ReturnType<typeof createCtx>, values: Record<string, any>) {
  return saveDraftBlockCore(ctx, {
    storeId: "stores:1",
    pageSlug: "about",
    blockKey: "story",
    values,
    updatedBy: "user:1",
  })
}

/** The values of the `cmsBlocks` row this save wrote, insert or patch alike. */
function storedValues(ctx: ReturnType<typeof createCtx>): Record<string, any> {
  const insert = ctx.inserted.find((row) => row.table === "cmsBlocks")
  if (insert) return insert.doc.values
  const patch = ctx.patched[0]
  if (!patch) throw new Error("no cmsBlocks row was written")
  return patch.patch.values
}

describe("saveDraftBlockCore rich text sanitisation", () => {
  it("strips a script tag from a new draft", async () => {
    const ctx = createCtx()
    await save(ctx, {
      description: {
        type: "richtext",
        textValue: "<p>Bonjour <strong>chef</strong></p><script>alert(1)</script>",
      },
    })

    expect(storedValues(ctx).description.textValue).toBe(
      "<p>Bonjour <strong>chef</strong></p>",
    )
  })

  it("strips an inline event handler on the update path too", async () => {
    // Every field of a block is re-sent on each save, so the patch branch is
    // the one an editor actually exercises after the first save.
    const ctx = createCtx({ _id: "cmsBlocks:1", values: {} })
    await save(ctx, {
      description: {
        type: "richtext",
        textValue: '<p onclick="steal()">Bonjour</p><img src=x onerror="alert(1)">',
      },
    })

    const stored = storedValues(ctx).description.textValue
    expect(stored).toBe("<p>Bonjour</p>")
    expect(stored).not.toContain("onerror")
  })

  it("keeps the formatting the editor is there to produce", async () => {
    const ctx = createCtx()
    await save(ctx, {
      description: {
        type: "richtext",
        textValue:
          '<p><em>Depuis</em> 1998</p><ul><li>Produits frais</li></ul><a href="https://example.com">Nos producteurs</a>',
      },
    })

    const stored = storedValues(ctx).description.textValue
    expect(stored).toContain("<em>Depuis</em>")
    expect(stored).toContain("<li>Produits frais</li>")
    expect(stored).toContain('href="https://example.com"')
  })

  it("refuses a javascript: link", async () => {
    const ctx = createCtx()
    await save(ctx, {
      description: {
        type: "richtext",
        textValue: '<a href="javascript:alert(1)">Cliquez</a>',
      },
    })

    expect(storedValues(ctx).description.textValue).not.toContain("javascript:")
  })

  it("leaves a plain text field alone", async () => {
    // A `text` field is escaped on render, so stripping its angle brackets
    // would corrupt legitimate content and protect nothing.
    const ctx = createCtx()
    await save(ctx, {
      badge: { type: "text", textValue: "Ouvert 7j/7 <sans interruption>" },
    })

    expect(storedValues(ctx).badge.textValue).toBe(
      "Ouvert 7j/7 <sans interruption>",
    )
  })

  it("cannot be dodged by relabelling the field as plain text", async () => {
    // Sanitisation is keyed off the registry, not off the `type` in the
    // payload. The relabelling route is closed one step earlier anyway:
    // validation refuses a value whose type disagrees with the definition, so
    // the write never reaches the table at all.
    const ctx = createCtx()
    await expect(
      save(ctx, {
        description: {
          type: "text",
          textValue: "<p>Bonjour</p><script>alert(1)</script>",
        },
      }),
    ).rejects.toThrow(/expects type "richtext"/)

    expect(ctx.inserted).toHaveLength(0)
    expect(ctx.patched).toHaveLength(0)
  })

  it("does not mutate the caller's values object", async () => {
    const ctx = createCtx()
    const values = {
      description: {
        type: "richtext",
        textValue: "<p>Bonjour</p><script>alert(1)</script>",
      },
    }
    await save(ctx, values)

    expect(values.description.textValue).toContain("<script>")
  })

  it("passes a cleared field through untouched", async () => {
    const ctx = createCtx()
    await save(ctx, {
      description: { type: "richtext", isCleared: true },
    })

    expect(storedValues(ctx).description).toEqual({
      type: "richtext",
      isCleared: true,
    })
  })
})
