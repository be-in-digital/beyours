---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Stop the delivery tiles sending a restaurant's own customers to a marketplace

The menu page carried a « Commandez aussi sur vos apps » section whose two
tiles were hard-coded to `https://www.ubereats.com` and
`https://www.deliveroo.com` — the marketplaces' HOME pages, not this
restaurant — under a COMMANDER button, on every menu, whether or not the store
had either integration. A restaurant's own site was routing its own customers
into a marketplace to be shown the competition, and paying commission on
anything they ordered there.

There was nothing to derive a correct link from: `platformStoreId` is an API
identifier (a UUID for Uber Eats, a site id for Deliveroo) and neither
platform's public URL is built from it. So the owner supplies it —
`storeIntegrations.storefrontUrl`, a field on the store's integration card —
and no tile renders without one.

`normalisePlatformStorefrontUrl` refuses what the hard-coded links were: a
non-https URL, a host that is not the platform's, embedded credentials, and the
platform's home page itself (a path of `/` is the defect, not a value). The host
check walks LABELS rather than matching a pattern over the string, because
`deliveroo.com.attacker.example` satisfies the second and is a domain somebody
else registers — and this value becomes an anchor on the restaurant's own site.

`storeIntegrations.publicLinks` is the storefront's read: a platform name and a
URL, for the integrations that are switched on and have one. Nothing else on the
row is a diner's business.
