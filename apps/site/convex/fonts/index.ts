/**
 * Unicode faces for the PDFs this deployment generates.
 *
 * `pdf-lib`'s `StandardFonts` are WinAnsi-only: `drawText` throws on any code
 * point outside Windows-1252. That is not an edge case for a signature — an
 * affiliate called Łukasz, Ayşe, Ștefan or Nguyễn could never produce a signed
 * contract, and therefore could never finish onboarding. A custom TrueType face
 * embedded through fontkit encodes anything the face covers, and renders what
 * it does not as `.notdef` rather than throwing.
 *
 * The faces are base64 in ./dejaVuSansRegular.ts and ./dejaVuSansBold.ts
 * because a Convex action has no filesystem to read a `.ttf` from. They are
 * subsets — see those files for the exact ranges and the regeneration command.
 *
 * NOTHING HERE IMPORTS `pdf-lib` OR FONTKIT, deliberately. Convex bundles every
 * module under `convex/` and this one carries no `"use node"`, so it has to
 * load in the isolate runtime too. The embedding — `registerFontkit`,
 * `embedFont` — belongs to ../affiliateSignature.ts, which is a Node action.
 * What is left here is pure and can be unit-tested without producing a PDF.
 */

export { DEJA_VU_SANS_REGULAR_BASE64 } from "./dejaVuSansRegular";
export { DEJA_VU_SANS_BOLD_BASE64 } from "./dejaVuSansBold";

/**
 * The code-point ranges the embedded subsets actually carry.
 *
 * Kept beside the fonts, and asserted by the tests, so "which names does this
 * render?" has an answer that can be checked rather than assumed. Must stay in
 * step with the `--unicodes` argument quoted in the two font modules.
 */
export const FONT_COVERAGE: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007e], // Basic Latin
  [0x00a0, 0x00ff], // Latin-1 Supplement — French accents, ç, œ is elsewhere
  [0x0100, 0x017f], // Latin Extended-A — Ł, ş, ż, ő, œ
  [0x0180, 0x024f], // Latin Extended-B — Romanian ș, ț
  [0x0300, 0x036f], // Combining diacritics — decomposed forms
  [0x0370, 0x03ff], // Greek
  [0x0400, 0x04ff], // Cyrillic
  [0x1e00, 0x1eff], // Latin Extended Additional — Vietnamese
  [0x2000, 0x206f], // General punctuation — the em dash the contract uses
  [0x20a0, 0x20bf], // Currency signs — €
  [0x2122, 0x2122], // ™
  [0x2116, 0x2116], // №
];

/** True when the embedded faces carry a glyph for this code point. */
export function isCovered(codePoint: number): boolean {
  return FONT_COVERAGE.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
}

/**
 * The distinct code points in `text` the faces cannot draw, in order of first
 * appearance. Empty for every Latin-script, Greek and Cyrillic name.
 *
 * Nothing throws on a non-empty result: a CJK or Arabic name still signs, and
 * the record still holds the exact string the signatory typed. It is the *PDF*
 * that degrades, drawing `.notdef` boxes — so the certificate prints the escape
 * sequence alongside, and the degradation is recorded instead of silent.
 */
export function unrepresentableCodePoints(text: string): number[] {
  const seen = new Set<number>();
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    // A newline never reaches drawText; it is not a rendering failure.
    if (cp === 0x0a || cp === 0x0d || cp === 0x09) continue;
    if (!isCovered(cp)) seen.add(cp);
  }
  return [...seen];
}

/** `"山田"` → `"U+5C71 U+7530"`. Printed on the certificate when needed. */
export function escapeCodePoints(text: string): string {
  return [...text]
    .map(
      (char) =>
        `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
    )
    .join(" ");
}

/** Base64 → bytes, without `Buffer`: this module must load in every runtime. */
export function decodeFontBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
