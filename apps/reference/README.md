# `apps/reference` — the engine's reference application

All ten `@be-in-digital/*` packages wired together into an application that
runs: storefront, admin dashboard, CMS, kitchen display, QR games, i18n.

**It is sold to nobody and deployed nowhere in production.** It is the test
bench: an engine feature is built here, proven here, then shipped as a published
package.

---

## Why it exists

The packages are not runnable on their own. `@be-in-digital/admin` provides
pages, `convex-schema` provides tables, `ui` provides components — but none of
that starts. Something has to wire them together to see what you are writing.

This app plays three roles:

| Role | In practice |
| --- | --- |
| **Test bench** | `pnpm dev:reference` runs the whole product from the engine sources, without publishing |
| **Type safety net** | Three packages (`admin`, `convex-functions`, `convex-schema`) ship as raw TypeScript and have no `build` task — their type errors only surface here |
| **E2E base** | The repository's 43 Playwright specs target this app |

Do not confuse it with `apps/themes`, which is the **deliverable**: the template
adds the client zone, the design templates, the site-creation scripts and the
sales demos.

---

## Size

| | |
| --- | --- |
| **Routes** | 98 pages, 6 API routes |
| **Engine packages consumed** | 9 out of 10 (all but `mcp-server`) |
| **Tests** | 13 Vitest files (117 tests, 13 gated behind live credentials), 43 Playwright specs |

Surfaces, by route group:

| Route group | Contents |
| --- | --- |
| `(storefront)` | Menu, product, cart, checkout, account, orders, blog |
| `(admin)` | Dashboard, products, categories, orders, kitchen, inventory, customers, team, email, games, languages, CMS, subscription |
| `(auth)` | Sign in, sign up, forgotten password |
| `game/[qrCodeId]` | Gamification flow — table QR → social actions → game → prize |
| `display/[storeId]` | Kitchen display system (KDS) |
| `preview/` | Preview of CMS pages and articles |

⚠️ **32 pages under `(admin)/` are redirects** to `/dashboard/*`:

```tsx
export default function Page() {
  redirect("/dashboard/products")
}
```

They are historical aliases kept so links do not break. Do not try to merge them
with the pages they point to.

---

## The 11 Deliveroo scenarios

They used to fall into a blind spot between the two runners: Vitest excluded
`**/e2e/**`, and the Playwright projects only match `*.spec.ts`. Written, never
executed.

They are Vitest suites, not Playwright ones — the exclude is now narrowed to
`**/e2e/**/*.spec.ts`, so `pnpm test` picks them up. Playwright is unaffected
and still lists 510 tests across 44 files.

Most of the assertions are offline: they build a Deliveroo webhook payload and
check its shape. Those run everywhere, on every push. **13 tests need something
live** and are gated behind environment variables, skipped by default:

| Gate | Requires | Covers |
| --- | --- | --- |
| `hasWebhookTarget` | `CONVEX_SITE_URL` **and** `DELIVEROO_WEBHOOK_SECRET` (or `DELIVEROO_CLIENT_SECRET`) | scenarios 2 and 8 — POST a signed webhook to a deployment |
| `hasDeliverooSandbox` | `DELIVEROO_CLIENT_ID`, `DELIVEROO_CLIENT_SECRET`, `DELIVEROO_BRAND_ID` | scenario 1 — calls the Deliveroo sandbox API |

`CONVEX_SITE_URL` is read straight from the environment for the gate, never
through `config`: the fallback there is a real deployment, and defaulting to it
would make every CI run fire signed payloads at a backend nobody asked for. Set
the variables to run the live half locally.

Three tests are `it.todo`: two asserted `expect(true).toBe(true)` and one only
held comments. They never could fail, so they were reporting green for nothing —
they need a mocked OAuth token and a mocked API response to become real.

---

## Getting started

From the monorepo root:

```bash
pnpm install
pnpm dev:reference
```

The Convex backend needs a second terminal, from this directory:

```bash
npx convex dev
```

Copy `.env.example` to `.env.local` first. A development Convex deployment is
enough — this app has no production instance.

---

## Commands

From this directory, or via `pnpm --filter @beyours/reference <cmd>`:

| Command | Effect |
| --- | --- |
| `pnpm dev` · `pnpm build` · `pnpm start` | Next.js |
| `pnpm lint` · `pnpm type-check` | Quality |
| `pnpm test` · `pnpm test:coverage` | Vitest |
| `pnpm test:e2e` · `pnpm test:e2e:ui` | Playwright |

---

## Relationship to the packages

The engine dependencies are declared as `workspace:^`: this app always builds
against the **repository's current engine**, never against a published version.
That is intentional — it is what makes the effect of a change in `packages/`
immediately visible.

The corollary: what passes here does not prove the published version will pass.
The client template consumes the **published** packages in its distribution
mirror. That is where a badly declared `exports` or `files` field shows up.

---

## Related documentation

- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — the app's design system
- [`MISE_EN_PROD.md`](./MISE_EN_PROD.md) — inherited checklist, read with care
- [`../docs/`](../docs) — 31 pages of product documentation: guides, Convex API
  reference, deployment
- [Root README](../../README.md) — the monorepo and its three apps
