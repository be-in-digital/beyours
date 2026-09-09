---
"@be-in-digital/ui": major
"@be-in-digital/admin": major
"@be-in-digital/restaurant": major
"@be-in-digital/marketing": major
"@be-in-digital/core": patch
"@be-in-digital/mcp-server": patch
---

Take the dead half of four published packages off the client's API

The sweep behind #413 counted, rather than guessed, what these packages export
that nothing imports. Most of it is harmless clutter, and
`tasks/reference-themes-divergence.md` already ruled on that class: removing a
name from a published package is "a breaking major that buys nothing but a
shorter barrel", so twenty consumer-free `packages/ui` components stay. What
follows is the residue that argument does **not** cover — exports that are
broken rather than merely unused, and exports left behind by a removal that only
finished on one side of a package boundary.

**`@be-in-digital/ui` shipped a second toast system whose hook could only
throw.** The product's toasts are `sonner`, mounted in each app's
`app/providers.tsx` and imported by 129 files. Beside it, `Toast.tsx` held a
module-private `ToastContext` defaulting to `undefined`, and exported a
`ToastProvider` that supplied it and a `useToast` that threw `useToast must be used within ToastProvider` when it was
absent — and `ToastProvider` was mounted in no app, no package and no test. So
`useToast` was not an export nobody happened to import; it was an export with no
reachable behaviour except the throw. A probe run before the removal confirmed
both halves: the hook resolved off the root barrel as a function, and rendering a
consumer of it raised that exact error. Provider, hook and context are gone. (Only the first two were ever on the
published API; an earlier draft of this note said all three were.)
`Toast` — the presentational box, which needs no provider and carries the
accessible-name test for its dismiss button — deliberately stays, because "a hook
whose every call throws" and "a component nobody imports" are different claims
and only the first was acted on. `packages/ui/src/__tests__/one-toast-system.test.ts`
holds it: the barrel is `export * from "./Toast"`, so anything added to that file
is republished without a second decision, which is how the provider reached a
client API in the first place.

**`@be-in-digital/marketing` kept the pure half of a mutation #397 removed.**
That PR deleted `incrementRevenue` from `convex-functions` and left a tombstone
saying why — nothing writes a `converted` email event and no order carries the
campaign that led to it, so the attribution behind a "revenu attribué" figure
does not exist in this schema. `incrementRevenueStat` computed the identical
`{ revenue + amount, converted + 1 }` shape for that caller, on the far side of a
package boundary, and was kept alive only by its own two tests. It now carries
the same tombstone in `stats.ts`. Two siblings in that file,
`incrementCampaignStats` and `calculateSubscriberMetadata`, are equally
consumer-free — but they are the barrel-pruning case the divergence doc rules
against, not the finishing of a removal, so they are recorded here and left
alone.

**`@be-in-digital/restaurant` published five cart selectors nothing selected
with.** `useCartItems`, `useCartSummary`, `useCartItemCount`, `useCartOrderType`
and `useCartStoreId` were compiled into `dist` and exported from both the root
and `./hooks`, with zero references in either app, any package or any test. The
storefront reaches for `useCartStore` with an inline selector instead — about
sixty call sites — which is the ordinary Zustand idiom and the reason the
wrappers never took. `useCart` stays: `packages/mcp-server`'s registry tells a
client developer to import it, so removing it would break an instruction rather
than an unused export. `apps/docs` taught `useCartSummary` in two code samples
and now teaches `getSummary` off the store, which is what the cart page actually
does.

**`@be-in-digital/admin` exported four components no screen mounts.** Two auth
forms — `ForgotPasswordForm` and `ResetPasswordForm` — which both apps rewrote
inline from `@be-in-digital/ui` primitives rather than import, plus a
`StatusBadge` and a `DateDisplay`. The `StatusBadge` *interface* in
`lib/vocabulary.ts` is a different, live thing and is untouched.

**Two more were deleted and put back, and the reason is worth keeping.**
`PropagationModal` and `DuplicateCatalogModal` are mounted by nothing either, and
the first draft of this change removed them on the stated ground that "there is
no propagation or catalogue-duplication path in `convex-functions` at all". That
was false, and adversarial review caught it: `products.updateWithPropagation`
and `products.duplicateCatalog` both exist, are registered as `storeMutation` in
both apps, are permission-guarded, and are covered by `catalogue-scope.test.ts`
and `authorization.test.ts`. `PropagationModal`'s
`onConfirm(scope, targetStoreIds)` is an exact match for
`updateWithPropagation`'s validator. They are the unmounted UI of a *built*
feature — multi-store propagation, which is what "1 restaurant owner = 1-∞
locations" is made of — and that closes by wiring them in, not by deleting them.
Recorded as the near-miss it was: this repository's own named failure mode is a
claim nobody checked, and this one would have shipped as the changelog of a
major bump.

**`@be-in-digital/core` carried 466 lines of i18n examples.** Fifteen exported
`example1_…` through `example15_…` functions, on no barrel, in no `exports` map
and in no `tsup` entry — so never compiled into `dist`, but shipped in the
tarball by `"files": ["dist", "src"]`. No supported import path reaches them,
which is why this is a patch. Two `apps/docs` pages cited the file for a claim
about the package shipping no JSX; they now make that claim on their own
authority.

`@be-in-digital/mcp-server` is a patch because its registry advertised `Toast` to
client builds as a "Toast notification system". It is a box, and now says so.

**One thing this does NOT do, said plainly.** The class (c) sweep in the same
change removes 71 public *registrations* from `apps/*/convex` while leaving the
handler definitions they wrapped exported from `@be-in-digital/convex-functions`
— so roughly sixty definitions there now have no registration anywhere. That is
deliberate, and it is the opposite of what was done to `incrementRevenueStat`
above, so the difference is worth stating. `incrementRevenue` was removed by
#397 *with a tombstone explaining that the figure it computed cannot exist in
this schema*, and the marketing half computed that same impossible figure. These
definitions compute things that are perfectly possible; they are the
implementation a restored six-line wrapper would call, which is how a screen
gets wired to one again. Pruning them is a decision about that package's own
surface, not a loose end of this one.
