/// <reference types="vite/client" />

/**
 * Every referral state the schema can store must be readable in the console.
 *
 * THE BUG (#411, B2-F4). #384 added an eighth referral state, `paying` — a
 * commission claimed by a payout run whose transfer is not yet confirmed. It
 * reached the schema, `claimForPayout`, `releasePayoutClaim`, the affiliate's
 * own totals and the invoice-upload refusal. It reached none of the surfaces
 * that READ a status:
 *
 *   - `REFERRAL_STATUS` had no entry, and `badgeFrom` falls back to
 *     `{ label: value }` — so a French ops console rendered the raw English
 *     literal `paying` in the grey badge it uses for "unknown".
 *   - `REFERRAL_FILTERS` had no option, and `admin.listReferrals`' own
 *     validator refused the value, so those rows could not be listed at all —
 *     not even by editing the URL by hand.
 *
 * The window is exactly the one in which money is moving to an affiliate and
 * has not landed, which is when somebody would want to look.
 *
 * A test that only asserted `REFERRAL_STATUS.paying` exists would not have
 * caught #384 and will not catch the ninth state. This one reads the SCHEMA and
 * requires the reading surfaces to cover it, so adding a state without a label
 * fails a build. Same shape, and the same reasoning, as the engine's
 * `packages/admin/src/pages/system/__tests__/audit-log.test.ts`.
 */

import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { REFERRAL_STATUS_VALIDATOR } from "../convex/admin";
import { REFERRAL_STATUS } from "../components/admin/status";
import { AFFILIATE_REFERRAL_STATUS } from "../lib/referral-status";

/** The `status` literals the `referrals` table actually allows. */
function schemaStatuses(): string[] {
  // Reaching into the validator is the point: the test has to read the schema
  // itself, not a copy of it, or it proves nothing.
  const validator = (schema.tables.referrals as any).validator;
  return validator.fields.status.members.map((member: any) => member.value);
}

/** The literals `admin.listReferrals` will accept as a filter. */
function filterableStatuses(): string[] {
  return (REFERRAL_STATUS_VALIDATOR as any).members.map((m: any) => m.value);
}

describe("referral status vocabulary", () => {
  it("reads a non-empty union out of the schema", () => {
    // Guards the guard: an empty list would make every assertion below
    // vacuously true.
    expect(schemaStatuses().length).toBeGreaterThan(5);
    expect(schemaStatuses()).toContain("paying");
  });

  it("gives every stored status a French label", () => {
    const missing = schemaStatuses().filter((s) => !(s in REFERRAL_STATUS));
    expect(missing).toEqual([]);
  });

  it("carries no label for a status the schema cannot store", () => {
    const allowed = new Set(schemaStatuses());
    const stale = Object.keys(REFERRAL_STATUS).filter((s) => !allowed.has(s));
    expect(stale).toEqual([]);
  });

  it("lets the console filter on every stored status", () => {
    const filterable = new Set(filterableStatuses());
    const unfilterable = schemaStatuses().filter((s) => !filterable.has(s));
    expect(unfilterable).toEqual([]);
  });

  it("gives every stored status a label on the affiliate's own dashboard too", () => {
    // TWO vocabularies, and the guard has to cover both. The ops console has
    // one and the affiliate's dashboard has another, and #384 told neither —
    // so a test that checked only the first would have gone green while the
    // person whose money it is read `paying` in English.
    const missing = schemaStatuses().filter(
      (s) => !(s in AFFILIATE_REFERRAL_STATUS),
    );
    expect(missing).toEqual([]);
  });

  it("carries no affiliate label for a status the schema cannot store", () => {
    const allowed = new Set(schemaStatuses());
    const stale = Object.keys(AFFILIATE_REFERRAL_STATUS).filter(
      (s) => !allowed.has(s),
    );
    expect(stale).toEqual([]);
  });

  it("labels a commission whose transfer is in flight, in French", () => {
    // The specific regression, stated once so the failure names itself.
    expect(REFERRAL_STATUS.paying?.label).toBe("Versement en cours");
    expect(REFERRAL_STATUS.paying?.label).not.toBe("paying");
    expect(AFFILIATE_REFERRAL_STATUS.paying?.label).toBe("Versement en cours");
  });
});
