# `@be-in-digital/marketing`

Email marketing: the block-to-HTML renderer, segment filtering, subscriber CSV
import, double opt-in, campaign validation and delivery statistics.

`3.0.0` · 7 source files · 1,717 lines · shipped as `dist/` (tsup)

---

## Entry point

One export. Everything is named.

```ts
import {
  renderTemplateToEmailHtml,
  segmentFilter,
  parseSubscriberCsv,
} from "@be-in-digital/marketing"
```

| Module | Answers |
| --- | --- |
| `email-html-renderer.ts` | A block tree in, email-safe HTML out |
| `segment-filter.ts` | Which subscribers a segment resolves to |
| `csv-parser.ts` | A pasted or uploaded subscriber list, validated |
| `double-opt-in.ts` | The confirmation handshake |
| `campaign-validation.ts` | Is this campaign sendable |
| `stats.ts` | Opens, clicks, bounces, complaints |

---

## The renderer, and why it is hand-written

Email clients are not browsers. There is no cascade to rely on, no flexbox worth
trusting, and a stylesheet is as likely to be stripped as applied — so every
block renders to inline-styled table markup rather than to the component that
draws it on the web.

**19 block renderers** ship today:

`renderTextBlock` · `renderHeadingBlock` · `renderImageBlock` ·
`renderButtonBlock` · `renderProductBlock` · `renderDividerBlock` ·
`renderDecorativeDividerBlock` · `renderSpacerBlock` · `renderSocialBlock` ·
`renderCouponBlock` · `renderColumnsBlock` · `renderCountdownBlock` ·
`renderGalleryBlock` · `renderHeroBlock` · `renderHoursBlock` ·
`renderLocationBlock` · `renderMenuHighlightBlock` · `renderTestimonialBlock` ·
`renderVideoBlock`

Three helpers guard the output: `escapeHtml`, `sanitizeUrl`, and
`absolutiseUrls` — a relative URL in an email is a broken link, always.

> `renderTestimonialBlock` renders whatever the establishment wrote. It is not a
> licence to seed one: a delivered site never invents its own social proof, and
> there is no `reviews` table for one to come from.

---

## Where the sending happens

Not here. This package builds the message; `@be-in-digital/core` sends it.
Campaigns and automations run in **Convex Node actions** and send from there —
unlike the password-reset path, which POSTs to the app's `/api/email/send`.

Bulk sends are rate-limited to the SES sandbox ceiling by `createSESService`, and
that limit applies to Resend too, since both transports go through the same
service.

---

## Consumed from `dist/`

`main` is `./dist/index.js`. Rebuild after editing `src/`.

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

[Root README](../../README.md) · [`core`](../core)
