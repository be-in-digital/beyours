# `@be-yours/integrations`

The third-party delivery platforms: **Uber Eats**, **Deliveroo** and **Uber
Direct**. OAuth, menu synchronisation, order ingestion, store status, and the
webhook signature verification each platform demands.

`2.2.2` · 27 source files · 4,082 lines · shipped as `dist/` (tsup)

---

## Entry point

One export, three namespaces. That is deliberate — the platforms share nothing
but a shape, and flattening them would invite calling Deliveroo's mapper on an
Uber payload.

```ts
import { uberEats, deliveroo, uberDirect } from "@be-yours/integrations"
```

| Namespace | Modules |
| --- | --- |
| `uberEats` | `client`, `oauth`, `mappers`, `menu-sync`, `security`, `types` |
| `deliveroo` | `client`, `menu-push`, `menu-sync`, `orders`, `store-status`, `security`, `types` |
| `uberDirect` | `orders`, `status`, `security`, `types` |
| *(shared)* | `common/` — `backoff`, `errors`, `logger`, `menu-types`, `types` |

`common/errors.ts` defines `IntegrationError`, which carries the platform and
the upstream status. Every client surfaces failures through it rather than
throwing a bare `Error`.

---

## Credentials

Each platform is an **OAuth client pair plus a webhook secret**, never a single
API key:

```bash
UBER_EATS_CLIENT_ID=
UBER_EATS_CLIENT_SECRET=
UBER_EATS_WEBHOOK_SECRET=
UBER_DIRECT_WEBHOOK_SECRET=   # falls back to the Uber Eats one when unset
DELIVEROO_CLIENT_ID=
DELIVEROO_CLIENT_SECRET=
DELIVEROO_WEBHOOK_SECRET=
```

> `UBER_EATS_API_KEY`, `DELIVEROO_API_KEY` and `UBER_DIRECT_CUSTOMER_ID` were
> documented for a long time and are read by **no code at all**. An operator
> setting them configured nothing. The authoritative list is
> `packages/core/src/env/schemas.ts`.

---

## Where platform links live

In the `storeIntegrations` table, keyed by `storeId` + `platform`. **Not** in
`stores.integrations`, which is still declared because old documents hold it and
which nothing reads or writes.

Products carry `externalIds.uberEatsId` and `externalIds.deliverooId`.

---

## Token handling

The clients cache their bearer at module level. Two behaviours are asserted, and
each was mutation-checked — breaking the production rule makes exactly that test
fail:

| Case | Behaviour |
| --- | --- |
| `401` | Drop the cached token, mint a new one, replay the request **once**, carrying the fresh bearer |
| `500` | Return it untouched. No retry, no token burned |
| OAuth endpoint fails | Surfaces as `IntegrationError` with its status and platform |

Tests that mock `globalThis.fetch` go through `withMockedFetch`, which clears the
module-level cache on both sides so a mocked token never leaks into a live suite
and vice versa.

---

## The Deliveroo scenarios

The 11 scenario suites live in `apps/reference/e2e/deliveroo/`. They are
**Vitest** suites, not Playwright ones, and they used to fall into a blind spot
between the two runners — Vitest excluded `**/e2e/**` and Playwright only matches
`*.spec.ts`, so they were written and never executed. The exclude is now narrowed
to `**/e2e/**/*.spec.ts`.

Most assertions are offline and run everywhere. **13 tests need something live**
and are gated, skipped by default:

| Gate | Requires | Covers |
| --- | --- | --- |
| `hasWebhookTarget` | `CONVEX_SITE_URL` **and** `DELIVEROO_WEBHOOK_SECRET` (or `DELIVEROO_CLIENT_SECRET`) | POST a signed webhook to a deployment |
| `hasDeliverooSandbox` | `DELIVEROO_CLIENT_ID`, `DELIVEROO_CLIENT_SECRET`, `DELIVEROO_BRAND_ID` | Calls the Deliveroo sandbox API |

`CONVEX_SITE_URL` is read straight from the environment for the gate, never
through `config`: the fallback there is a real deployment, and defaulting to it
would make every CI run fire signed payloads at a backend nobody asked for.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm build` | tsup → `dist/` |
| `pnpm dev` | tsup in watch mode |
| `pnpm lint` · `pnpm type-check` | Quality |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm clean` | Remove `dist/` and `node_modules` |

---

[Root README](../../README.md)
