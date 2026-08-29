---
"@be-in-digital/admin": minor
---

The kitchen display's sound alerts can be configured.

`stores.soundConfig` decides which alerts sound and how loudly, and every piece
was already there — the schema field, an audited mutation, and the reader on the
routed kitchen screen. No screen wrote it, so every establishment ran on a
literal hardcoded inside `KitchenContent`: a restaurant could not turn down a
beep that repeats every thirty seconds for as long as a printer stays stuck.

The store detail page gains a **Cuisine** tab with the three alerts — new ticket,
overdue ticket, blocked print — each with a switch, a volume, and a preview
button. Choosing a volume for a screen in a noisy kitchen without hearing it is
guesswork, and the display already knew how to make the sound.

The catalogue moves to `lib/kitchen-alerts`, shared by the editor that writes the
setting and the display that plays it. It had been written out twice already —
the defaults in `KitchenContent`, the frequencies in `KitchenSoundManager` — and
a third copy in the editor would have been the one that drifted.

`resolveSoundConfig` fills the setting in field by field rather than defaulting
the object whole, so an establishment configured before an alert existed does not
leave the display reading `undefined.enabled`. The form opens on the display's
own fallbacks for an establishment that has never been configured, so it shows
what the kitchen is currently hearing instead of claiming the alerts are off.
