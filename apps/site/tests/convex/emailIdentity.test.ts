/// <reference types="vite/client" />

/**
 * The anti-self-referral guard compared two addresses as raw strings, and an
 * adversarial re-check walked through it with one character:
 *
 *     apporteur@example.test          -> blocked
 *     apporteur+facture@example.test  -> 875 000 instead of 950 000, commission paid
 *     " apporteur@example.test "      -> same
 *
 * Same inbox each time. 750 € off a Premium build plus a 500 € commission to
 * the affiliate, and repeatable — each invented tag is also a fresh
 * rate-limit subject, so the per-email window never bound either.
 */

import { describe, expect, test } from "vitest";
import { isSameMailbox, mailboxIdentity } from "../../convex/emailIdentity";

describe("two addresses that reach the same person", () => {
  test.each([
    ["identical", "a@x.test", "a@x.test"],
    ["case", "Apporteur@X.test", "apporteur@x.test"],
    ["surrounding space", " a@x.test ", "a@x.test"],
    ["a sub-address label", "a+facture@x.test", "a@x.test"],
    ["two different labels", "a+one@x.test", "a+two@x.test"],
    ["a label and case", "A+Facture@X.test", "apporteur@x.test".replace("apporteur", "a")],
    ["a fully-qualified domain", "a@x.test.", "a@x.test"],
    ["gmail dots", "jean.dupont@gmail.com", "jeandupont@gmail.com"],
    ["gmail dots and a label", "j.dupont+beyours@gmail.com", "jdupont@gmail.com"],
    ["googlemail dots", "j.d@googlemail.com", "jd@googlemail.com"],
  ])("%s", (_label, a, b) => {
    expect(isSameMailbox(a, b)).toBe(true);
  });
});

describe("two addresses that do not", () => {
  test.each([
    ["different local parts", "a@x.test", "b@x.test"],
    ["different domains", "a@x.test", "a@y.test"],
    ["dots outside gmail", "j.dupont@x.test", "jdupont@x.test"],
    ["a label that is the whole local part", "+tag@x.test", "tag@x.test"],
    ["a subdomain", "a@mail.x.test", "a@x.test"],
  ])("%s", (_label, a, b) => {
    expect(isSameMailbox(a, b)).toBe(false);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["no @", "apporteur"],
    ["two @", "a@b@x.test"],
    ["no local part", "@x.test"],
    ["no domain", "a@"],
    ["a domain of dots", "a@..."],
  ])("an unreadable address (%s) never matches", (_label, weird) => {
    /* An address this cannot parse is not evidence of a match. Returning true
       would refuse the discount to every customer it cannot read; returning
       false only lets through a case it could not judge. */
    expect(mailboxIdentity(weird as string | null)).toBeNull();
    expect(isSameMailbox(weird as string | null, "a@x.test")).toBe(false);
    expect(isSameMailbox("a@x.test", weird as string | null)).toBe(false);
  });

  test("two unreadable addresses are not each other", () => {
    expect(isSameMailbox("nonsense", "nonsense")).toBe(false);
  });
});

describe("the identity itself", () => {
  test("reduces to the deliverable mailbox", () => {
    expect(mailboxIdentity("  Jean.Dupont+BeYours@GMail.com. ")).toBe(
      "jeandupont@gmail.com",
    );
  });

  test("leaves a normal address alone but for case", () => {
    expect(mailboxIdentity("Chef@Trattoria.fr")).toBe("chef@trattoria.fr");
  });
});
