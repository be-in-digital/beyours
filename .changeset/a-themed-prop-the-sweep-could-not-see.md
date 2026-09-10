---
"@be-in-digital/ui": patch
---

Measure the colours a `styles={{ slot: … }}` map paints

`scanContrast` read the `style` attribute and stopped there, so the prop a
third-party component takes to be themed went unmeasured entirely. This
codebase themes exactly one component that way — `reactour`, in the onboarding
tour — which is the first screen a new owner sees.

Measured before the change: forcing the tour badge to
`color: hsl(var(--primary))` on the same `backgroundColor`, a 1.000:1
inversion, left `apps/themes`'s sweep at 8 passed and
`onboarding-tour.test.ts` at 25 passed. Invisible text, and nothing in the
repository could see it.

A slot is not a `style` attribute, and the difference decides how it is read. A
`style` paints the element it is written on, so a colour with no background of
its own is measured against the surface the sweep tracked down the tree. A slot
is rendered by the third party, somewhere the JSX never describes. So only a
slot setting BOTH members of the pair is read — a half-pair would be measured
against a surface it never lands on — and a slot is contained in both
directions: it takes no class from the element declaring it, and it never
becomes the surface a child inherits. That last one is not theoretical.
`<TourProvider styles={{ popover: … }}>` wraps the whole admin, so a leak there
would measure every page in the application against the popover's background.

Failures name the slot (`styles.badge:color:…`), because a map has several
slots and one report.

Two of the sweep's own heuristics were wrong about a slot for the same reason,
and both were found by writing the tests rather than by reading the code. Each
reads a fact about the element the prop is WRITTEN on: `isGraphical` means "no
JSX children, so it renders no text" — true of an icon, false of a self-closing
`<Tour styles={{ popover: … }} />` whose children the third party supplies —
and the type scale is likewise the declaring element's, not the slot's. Either
one firing halves a slot's floor to 3:1. A slot is now judged at the floor for
body text, 4.5:1 at 16px/400.
