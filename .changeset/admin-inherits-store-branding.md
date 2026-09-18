---
"@be-yours/admin": minor
---

Paint the dashboard with the establishment's own colours (#512).

`buildBrandingCss` has always derived the tokens only the admin reads —
`--sidebar-primary` and its label, `--sidebar-accent`, `--sidebar-ring`, and
`--chart-1`, whose comment states its purpose outright: "so the dashboard's
first series follows the brand instead of staying orange under a red one".
Nothing ever mounted that stylesheet on an admin page. `StoreTheme` is rendered
from `(storefront)/layout.tsx` and `(auth)/layout.tsx`; the admin layout had no
counterpart, so an owner who set a colour in Design got a branded shop and a
dashboard still painted the engine's orange.

`AdminTheme` is the counterpart, and the difference from its sibling is the one
thing worth knowing about it: it passes **no** `scopes`. The storefront palette
is declared on `.storefront-theme`, a `<div>`, so `StoreTheme` must name that
element or the shell's own declaration wins on the element it sits on — that is
#410. The dashboard's tokens are declared on `:root` and `.dark`, which is what
`buildBrandingCss` targets by default; a scope here would aim the stylesheet at
an element the admin never renders, producing the mirror image of the same bug.

It follows the establishment being ADMINISTERED, through `useAdminStore` — the
same one the sidebar already takes its logo and brand name from — so switching
store in the selector repaints. On a multi-store account the colour is what says
which restaurant is being edited.

Guarded on three seams: both apps' admin layouts must mount it, the component
must not scope itself to the storefront shell, and the deriver must keep writing
the five tokens that make the mounting worth anything. Each was run red-first.
