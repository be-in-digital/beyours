/**
 * SIRET validation: 14 digits + Luhn check digit (SIREN/SIRET algorithm).
 * Shared by the affiliate screens (contract, profile). The server
 * (`convex/affiliateUsers.ts`) revalidates on its side — this one is for UX.
 */
export function validateSiret(raw: string): boolean {
  const digits = raw.replace(/\s/g, "");
  if (!/^\d{14}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = parseInt(digits[i]!, 10);
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}
