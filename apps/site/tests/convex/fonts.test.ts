/// <reference types="vite/client" />

/**
 * What the embedded faces can draw, asserted rather than assumed.
 *
 * `FONT_COVERAGE` is a claim about two base64 payloads. If the subsets are
 * regenerated with different `--unicodes`, this is what notices — and the
 * question it answers, "which signatories can produce a readable contract?",
 * is the one that cost an affiliate their onboarding.
 */

import { describe, expect, test } from "vitest";
import {
  DEJA_VU_SANS_BOLD_BASE64,
  DEJA_VU_SANS_REGULAR_BASE64,
  decodeFontBase64,
  escapeCodePoints,
  isCovered,
  unrepresentableCodePoints,
} from "../../convex/fonts";

describe("embedded font payloads", () => {
  for (const [face, payload] of [
    ["regular", DEJA_VU_SANS_REGULAR_BASE64],
    ["bold", DEJA_VU_SANS_BOLD_BASE64],
  ] as const) {
    test(`the ${face} face decodes to a TrueType file`, () => {
      const bytes = decodeFontBase64(payload);
      expect(bytes.byteLength).toBeGreaterThan(10_000);
      // TrueType's magic number: 0x00010000.
      expect([...bytes.slice(0, 4)]).toEqual([0x00, 0x01, 0x00, 0x00]);
    });
  }
});

describe("coverage of the names the programme receives", () => {
  const RENDERABLE = [
    "Jean Dupont",
    "Aurélie Lefèvre",
    "Łukasz Kowalski", // Ł U+0141, Latin Extended-A
    "Nguyễn Văn An", // ễ U+1EC5, Latin Extended Additional
    "Ayşe Şahin", // ş U+015F
    "Ștefan Popescu", // Ș U+0218, Latin Extended-B
    "Dmitro Koval",
    "Дмитро Коваль", // Cyrillic
    "Γιώργος Παπάς", // Greek
    "3 500 € — art. L. 221-28", // punctuation and currency in the contract body
  ];

  for (const name of RENDERABLE) {
    test(`"${name}" is fully covered`, () => {
      expect(unrepresentableCodePoints(name)).toEqual([]);
    });
  }

  test("scripts outside the subset are reported, not hidden", () => {
    expect(unrepresentableCodePoints("山田 太郎")).toEqual([0x5c71, 0x7530, 0x592a, 0x90ce]);
    expect(unrepresentableCodePoints("محمد علي").length).toBeGreaterThan(0);
  });

  test("the WinAnsi cliff the standard fonts fell off is inside the subset", () => {
    // The exact code points measured on the old Helvetica path.
    for (const cp of [0x0141, 0x1ec5, 0x015f]) {
      expect(isCovered(cp)).toBe(true);
    }
  });

  test("escapes name an unrenderable signatory for the certificate", () => {
    expect(escapeCodePoints("山田")).toBe("U+5C71 U+7530");
    expect(escapeCodePoints("Ł")).toBe("U+0141");
  });
});
