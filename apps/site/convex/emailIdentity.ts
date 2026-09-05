/* ── Is this the same mailbox? ──

   Asked by the anti-self-referral guard, which exists to stop an affiliate
   buying their own build with their own code: 750 € off a Premium creation
   AND a 500 € commission to themselves, repeatable.

   That guard used to compare the two addresses as raw lowercased strings, and
   an adversarial re-check walked straight through it:

       apporteur@example.test          -> blocked
       apporteur+facture@example.test  -> 875 000 instead of 950 000, commission paid
       " apporteur@example.test "      -> same

   Every one of those is the same inbox. `+tag` addressing is supported by
   Gmail, Outlook, Fastmail and most others, costs nothing to invent, and gave
   an unlimited supply of "different" buyers — each also a fresh rate-limit
   subject, so the per-email window never bound either.

   Deliberately a FRAUD comparison, not an address validator: it answers "would
   these two deliver to one person?", and it is used only to REFUSE a discount.
   So over-matching costs a referral that should probably not have been paid,
   while under-matching costs 1 250 €. Nothing here is used to send mail — the
   address stored and mailed is always the one the customer typed.

   Plain module, no Convex registration, so the rule can be read and tested on
   its own — same reasoning as ./stripeMode and ./referralDiscount. */

/** Domains where Gmail's "dots are not significant" rule applies. */
const DOT_INSENSITIVE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * An address reduced to the mailbox it reaches.
 *
 * Returns `null` for anything without exactly one `@` and a non-empty local
 * part and domain — a caller comparing two `null`s must treat them as NOT the
 * same mailbox, or every malformed address would match every other.
 */
export function mailboxIdentity(email: string | null | undefined): string | null {
  if (!email) return null;

  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@")) return null;

  let local = trimmed.slice(0, at);
  /* A trailing dot is a legal, fully-qualified domain and resolves identically:
     `x@example.test.` is `x@example.test`. */
  const domain = trimmed.slice(at + 1).replace(/\.+$/, "");
  if (!local || !domain) return null;

  /* Sub-addressing: everything from the first `+` is a label the provider
     strips before delivery. */
  const plus = local.indexOf("+");
  if (plus === 0) return null; // no local part left once the label is removed
  if (plus > 0) local = local.slice(0, plus);

  if (DOT_INSENSITIVE_DOMAINS.has(domain)) {
    local = local.replaceAll(".", "");
    if (!local) return null;
  }

  return `${local}@${domain}`;
}

/**
 * Whether two addresses reach the same person.
 *
 * `false` when either cannot be reduced: an unparseable address is not
 * evidence of a match, and treating it as one would refuse the discount to
 * every customer whose address this function cannot read.
 */
export function isSameMailbox(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = mailboxIdentity(a);
  if (left === null) return false;
  return left === mailboxIdentity(b);
}
