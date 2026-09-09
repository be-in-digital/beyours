---
"@be-in-digital/convex-functions": minor
"@be-in-digital/convex-schema": major
"@be-in-digital/core": major
"@be-in-digital/admin": minor
"@be-in-digital/restaurant": patch
---

Serve no draft dish, route no menu event by guess, and make eleven guards see

**A public query served unpublished products.** `products.getManyByIds` took an
array of ids and returned the documents behind them with no filter of any kind:
no `isActive`, no ceiling on how many ids one call may look up. It is the query
the favourites grid calls before any sign-in, and ids are not secret — they
appear in order lines, in favourites and in the storefront's own DOM — so
anything holding one read the dish behind it whatever its state: name, cost,
allergens, platform overrides, for a draft or a dish taken off the menu. Every
other public read of that table already honoured the flag. It now does too, and
caps the lookup at `MAX_PRODUCT_ID_LOOKUP` so an anonymous caller does not choose
the read count. Deliberately still cross-store: a deployment is one client's, and
the favourites grid splits "here" from "your other establishments" on purpose.

**A Deliveroo menu event could land on a sibling establishment.** The menu path
matched `site_id` with a bare `.find()` and, when that missed, fell through to
the BRAND — which covers every location of a chain, so the sync status was
written to whichever sorted first. The event said "site 42's menu failed
validation"; the screen said the Boulevard branch's had. `resolveMenuStoreIntegration`
applies the order path's own refusal policy: a named site's verdict is final,
and a brand that matches more than one establishment is `ambiguous_store`, which
is the ordinary shape of a two-location client rather than an edge case.

**A refused SVG kept its bytes for thirty days.** `cmsMediaConfirmUpload` reads
an uploaded SVG back, refuses it for active content, and then deleted it with a
bare `DeleteObjectCommand` — which on the versioned bucket `setup-aws.sh` builds
writes a delete marker and retains every version. That is the defect #331 removed
from `cmsMediaDelete.ts` and this path reintroduced, for the one object we have
decided is hostile. It goes through `purgeS3Objects` now.

**CMS video uploads landed as `.bin`.** The upload route kept a private
six-entry MIME-to-extension map while `@be-in-digital/cms`'s `MIME_TO_EXT` —
which calls itself the single source of truth, and is what the presigned Convex
flow uses — held twelve. `ALLOWED_MIME_TYPES.cms` admits mp4, webm and three
Office formats; all six fell through to `"bin"`.

**The order-confirmation email printed no timing row, for any order, ever.**
`timingLine` reads `order.estimatedPrepTime` and `orders.create` wrote the prep
time it computes onto the kitchen ticket — a different document. `orders.create`
now stamps the longest line's preparation time on the order as well, off the
products its verification loop already holds, and stays silent when no dish
declares one rather than promising "environ 0 minutes".

**Dead code that contradicted the live product.** `packages/core`'s
`src/auth/config.ts` is gone, with `createAuthConfig`, `authHooks`,
`emailTemplates`, `authErrors`, `validatePassword`, `validateEmail`,
`DEFAULT_SESSION_EXPIRY`, `DEFAULT_SESSION_REFRESH` and `MIN_PASSWORD_LENGTH`:
zero call sites, and it declared `MIN_PASSWORD_LENGTH = 8` against the live
`minPasswordLength: 12`, with five lifecycle hooks whose bodies were a
`console.info` and a list of TODOs over names like "lock the account after N
attempts". `@be-in-digital/convex-schema` loses the six printer types that
outlived the `printerSettings` table — `PrinterType = 'network' | 'usb' |
'bluetooth'`, the ESC/POS transports `CLAUDE.md` records as decided against.
Both are BREAKING on a published API and neither had a consumer.

**`@be-in-digital/admin`** gains `PAYMENT_STATUS_LABELS`, so the payments screen
stops declaring six operator-facing strings of its own, and the dashboard's
recent-orders table stops declaring eleven — `lib/vocabulary.ts` claimed "label
drift is now impossible" while two screens held their own copies.

**And the guards that could not see what they were written for.** The attribution
guard missed four shapes `CLAUDE.md` names by hand — a robot-emoji signature, a
bare "Claude Code" in a body line, "AI-generated", "Made with Claude" — while
still accepting the collisions that matter here (this product has an AI-generated
blog; Claude is an ordinary French given name). The swallowed-pipe rule needed
spaces around the pipe, so `2>&1|tee` walked through it, and never read
`apps/themes/.github/workflows/`, the CI every client runs. The turbo test inputs
still hashed `apps/themes`'s `.convex-build/` and `tsconfig.tsbuildinfo`, so a
local typecheck threw the monorepo's whole test cache away. The Convex manifest
guard's transcription of `entryPoints()` omitted `looksLikeNestedComponent`, so a
legal local component would have turned it red. The mirror publisher walked the
filesystem and shipped untracked files; it now ships what git tracks, minus the
exclusions, and refuses rather than guessing when git cannot answer. The
Infisical doc-claim checker knew one phrasing and the document used another, so
it reported "0 folder claim(s) checked" and exited 0.
