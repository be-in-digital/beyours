---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Give automations an editor, and refuse a trigger that cannot fire

`packages/admin/src/pages/email/` shipped six pages and the sidebar listed the
same six. None of them created, edited or deleted an automation. The mutations
existed and were permission-guarded — `create`, `update`, `remove`, `activate`,
`pause` — and **nothing in the product called any of them**. The one automation
query a screen read was `listActive`, filling a dashboard card that said
« Aucune automation active » to every owner, permanently, because there was no
path to a first one. An owner's only way to build a sequence was a Convex API
call.

It became the binding constraint with #268: three triggers reach subscribers now
— `welcome` on double opt-in, `post_order` on every confirmed order, `inactive`
on a daily sweep — and five settings toggles gate them. The engine worked and
there was no supported way to feed it. An owner switching « Post-commande » on
got a toggle that saved, an engine that dispatched, and no email, because the
toggle enabled a sequence that did not exist.

The new screen lists automations with their trigger, step count, status and sends;
creates and edits a name, a trigger and an ordered list of steps; and activates,
pauses or deletes one. **Every delay is presented as counted from the trigger**,
which is what `delayForStep` does — an editor that chained delays would drift and
would not match what the owner wrote.

Three server-side changes came with it:

- **`inactiveAfterDays` is accepted by `create` and `update`.** It was on the
  table and read by the win-back sweep, and on neither mutation — so no caller,
  UI or API, could ever set it, and every win-back automation in existence was
  stuck on the 90-day default.
- **A trigger that cannot fire is refused**, at creation, at update and at
  activation. `birthday` has no record carrying a date of birth and
  `abandoned_cart` has no persisted cart; `TRIGGER_READINESS` already knew and
  nothing asked, so an owner could build one, activate it, watch it report
  « active », and never receive an email. Implement a trigger there and it
  becomes creatable on the same commit.
- **A sequence with no steps, a negative or fractional delay, or an absurd number
  of steps is refused.** The first would activate and send nothing; the second
  would schedule a send before the event that caused it.
