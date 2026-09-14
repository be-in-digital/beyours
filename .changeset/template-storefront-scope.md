---
"@be-in-digital/ui": patch
---

Read a selector list as one rule, so a template's palette can be measured

`parseTokens` matched a selector only when it sat immediately against the `{`,
so `:root,\n.storefront-theme { … }` read as neither. The 51 vertical templates
have to be written that way — `globals.css` declares the storefront palette on
`.storefront-theme`, and a property declared on an element beats the one it would
inherit — so a contrast sweep with a template overlay silently measured the
engine's palette 51 times and passed.

Rule heads are now collected once per sheet and split on commas, with each part
compared whole so `.storefront-theme` still does not match inside
`.dark .storefront-theme`.
