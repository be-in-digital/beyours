---
"@be-in-digital/core": minor
"@be-in-digital/mcp-server": patch
---

AWS is a site variable now: every client owns its AWS account.

`AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` were package-level
— one fleet-wide key, shipped to every deployment. `apps/themes/scripts/env.mjs`
copies them into each client's Convex deployment, so any one client's backend
could read and write every other client's media, and a departed client kept
working credentials that nothing rotated.

It also made a promise the product already sells undeliverable. The admin
console tells the restaurant its site belongs to it and can be migrated to the
team of its choice, and `maintenance.ts` accepts the scopes `assets` and
`emails` — but the media sat in a bucket BeYours owned and the mail left an SES
identity BeYours owned. The backup export says so outright: it carries
references and URLs, not the objects.

The three move into `siteEnvRequiredSchema`, still declared without `opt()`.
The tier changed, not whether a deployment can boot without them: an empty value
fails at startup exactly as before, and `validateAllEnv()` now reports a missing
`AWS_REGION` under `'site'` rather than `'package'` — which is where an operator
should go looking, since it is their own account.

`getSESConfig()` reads them off `getSiteEnv()` instead of `getPackageEnv()`. The
site reader is deliberately lenient and never throws, so the three arrive as
`string | undefined`; the adapter names whichever is missing rather than handing
`undefined` to the SDK, which would fail later with a signature error that says
nothing about the cause.

**Type change:** `PackageEnv` no longer carries the three AWS properties, and
`packageEnvSchema` no longer requires them. Nothing in the workspace read AWS
off `getPackageEnv()` except the SES adapter, but code outside it that does will
stop compiling — read them off `getSiteEnv()`.

`setup-aws.sh` (both copies) takes `SITE_SLUG` and `DOMAIN` and names the bucket,
the IAM user, the policy and the SES configuration set for that client. With no
`SITE_SLUG` it keeps the fleet-wide names unchanged, because those designate
resources that already exist in the shared account and renaming them here renames
nothing in AWS. Its preflight now prints the account it is about to provision
into and refuses on an `EXPECTED_ACCOUNT_ID` mismatch — with per-client accounts,
running against the wrong one is the new way to get this wrong.

Two things this does not do: clients already on the shared bucket still have to
be migrated, and SES production access is granted per AWS account, so each new
client needs its own request. Start it early in onboarding — until it is granted,
that restaurant sends no order confirmation and no password reset.
