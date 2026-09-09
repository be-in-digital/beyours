/**
 * One toast system, and it is not this package's.
 *
 * WHAT WAS BROKEN. `packages/ui` published a second toast system alongside the
 * one the product actually uses. `sonner` is mounted in both apps'
 * `app/providers.tsx` and imported by 129 files; next to it, `Toast.tsx`
 * exported a `ToastProvider`, a `ToastContext` defaulting to `undefined`, and a
 * `useToast` hook that threw when the context was absent. No app, package or
 * test ever mounted the provider — so `useToast` was not an unused export, it
 * was an export whose every possible call threw. A probe run before the removal
 * confirmed both halves: `useToast` resolved off the root barrel as a function,
 * and rendering a consumer of it raised
 * "useToast must be used within ToastProvider".
 *
 * WHY A TEST AND NOT JUST A DELETION. The barrel is `export * from "./Toast"`,
 * so anything added to that file is republished on `@be-in-digital/ui` without
 * a second decision being made. That is how the provider got onto a client's
 * API surface in the first place.
 *
 * WHAT THIS DOES NOT SAY. `Toast` — the presentational box — is deliberately
 * still exported and deliberately still has no consumer; see the file's own
 * header and the keep-list in `tasks/reference-themes-divergence.md`.
 */

import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

import * as UI from "../index"
import * as Components from "../components"

const UI_SRC = path.join(__dirname, "..")
const REPO = path.join(UI_SRC, "../../..")

/** The provider half. Each name was on the published API and is not any more. */
const REMOVED = ["ToastProvider", "useToast", "ToastContext"] as const

/** The presentational half, kept on purpose. */
const KEPT = ["Toast", "toastVariants"] as const

describe("the dead toast system", () => {
  it.each(REMOVED)("%s is not on the root barrel", (name) => {
    expect(name in UI).toBe(false)
  })

  it.each(REMOVED)("%s is not on the ./components subpath either", (name) => {
    expect(name in Components).toBe(false)
  })

  it.each(REMOVED)("%s is not declared in the source, only described in it", (name) => {
    // Declarations, not mentions. The file's header explains what was removed
    // and names all three; the first draft of this assertion matched that prose
    // and failed on the very comment recording the fix.
    const source = fs.readFileSync(path.join(UI_SRC, "components/Toast.tsx"), "utf8")
    const declaration = new RegExp(
      `(export\\s+)?(const|function|let|var|type|interface|class)\\s+${name}\\b`
    )
    expect(declaration.test(source)).toBe(false)
  })

  it.each(KEPT)("%s is still published — the box was never the problem", (name) => {
    expect(name in UI).toBe(true)
  })
})

describe("sonner is the toast system", () => {
  it("is what the apps mount, and this package does not compete with it", () => {
    for (const app of ["apps/reference", "apps/themes"]) {
      const providers = fs.readFileSync(path.join(REPO, app, "app/providers.tsx"), "utf8")
      expect(providers).toContain('from "sonner"')
      expect(providers).toContain("<Toaster")
    }

    // If packages/ui ever grows its own <Toaster> again, that is the second
    // system coming back under a new name.
    const componentFiles = fs
      .readdirSync(path.join(UI_SRC, "components"))
      .filter((f) => f.endsWith(".tsx"))
    const declaresToaster = componentFiles.filter((f) =>
      /export\s+(const|function)\s+Toaster\b/.test(
        fs.readFileSync(path.join(UI_SRC, "components", f), "utf8")
      )
    )
    expect(declaresToaster).toEqual([])
  })
})
