---
"@be-in-digital/admin": patch
---

Fix the product form's "Ajouter un choix" button doing nothing.

`addChoice` shallow-copied the options array and then pushed onto the option
object inside it — the same object react-hook-form was holding. The stored
value changed before `setValue` was told anything had, leaving `setValue` to
compare a value against itself, so the re-render that shows the new choice row
was not guaranteed. `removeChoice` had the same shape.

The array work moves to `product-options.ts` as pure functions that rebuild the
path they change and never touch their input, with unit tests pinning that
invariant.
