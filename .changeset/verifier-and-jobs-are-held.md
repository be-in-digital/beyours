---
"@be-in-digital/integrations": patch
---

No behaviour change: the Deliveroo verifier's shape checks are now held by
tests.

Every "rejects a malformed signature" case asserted `resolves.toBe(false)`, and
#532 measured what that was worth — drop the hex check, the length check and the
`sha256=` refusal, rebuild, and all of them stay green. They have to: none of
those inputs is a valid HMAC for the body, so the comparison refuses them
whichever gate they arrive at.

What the checks actually buy is stated in the function's own comment — a
malformed header returns `false` having reached `crypto.subtle` **not at all**,
rather than importing a key and running a verify over attacker-controlled bytes.
That is observable, and it is now observed. Dropping the three checks turns seven
cases red.
