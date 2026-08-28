---
"@be-in-digital/integrations": minor
"@be-in-digital/marketing": minor
"@be-in-digital/ui": patch
"@be-in-digital/admin": patch
---

Publish the packages whose source has been ahead of the registry since July,
and fix the one thing that kept a client site from compiling even then.

`@be-in-digital/integrations`, `@be-in-digital/marketing` and `@be-in-digital/ui`
all still sit at **2.0.2 on GitHub Packages**, and all three have had source
changes merged since — without a version bump. `changeset publish` then answers
`already published` and skips them, so the registry keeps serving the July
build under a version number the repository has since changed. Published 2.0.2
and workspace 2.0.2 are two different sets of code.

Nothing catches it in this repository, because `apps/themes` links these
packages with `workspace:^` and compiles against the current source. Only a real
client site installs the published artefact — and `beyours-boilerplate` has been
failing its type-check since 2026-08-16 for exactly this reason:

```
convex/emailCampaignActions.ts:136  Expected 2-3 arguments, but got 4
convex/uberDirect.ts:387            Property 'uberDirect' does not exist on ...
```

What each package has been withholding:

- **`integrations`** — the whole **Uber Direct** module (`#66`: book, track and
  cancel a courier, ~950 lines under `src/uber-direct/`) is exported from
  `src/index.ts` and absent from the published bundle. A feature the fleet has
  never received.
- **`marketing`** — `renderTemplateToEmailHtml` gained a fourth `options`
  argument and `absolutiseUrls` became public (`#185`). Without them, a campaign
  email built by a client site renders `/api/files/…` paths that resolve to
  nothing inside an inbox, and the call site does not compile.
- **`ui`** — the storefront fix that keeps `draft` establishments out of the
  public site (`#116`), plus accessibility repairs: `Switch` announces itself as
  a switch rather than a checkbox, `Card` carries the `data-slot` every other
  primitive has, `AddressAutocomplete` labels its fields, and `Dialog` stops
  overflowing the viewport.

**`admin` carries one real fix.** It ships raw TypeScript (`files: ["src"]`,
every `exports` entry pointing at a `.ts`), so a consumer type-checks its source
— and `@types/qrcode` sat in `devDependencies`, where an installing client never
sees it. `qr-codes-page.tsx` therefore failed to compile in every client site
while compiling fine here, because `apps/reference` happens to declare those
types itself. For a package that ships source, an `@types/*` backing a runtime
dependency is part of the public type surface: moved to `dependencies`.
`@types/react` stays in `devDependencies` — React is a peer dependency and the
consumer brings its own.

Otherwise no source changes — only the versions the registry should have been
serving.

Verified against a real `beyours-boilerplate` clone with these four packages
built from this branch and installed in place of the published ones: `tsc
--noEmit` goes from four errors to clean.
