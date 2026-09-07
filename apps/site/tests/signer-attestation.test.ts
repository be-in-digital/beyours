/// <reference types="vite/client" />

/**
 * The signer's IP, as evidence rather than as a claim.
 *
 * `signAffiliateContract` is a public Convex action and it used to take
 * `signerIp` as a string argument, which it then printed on the « certificat de
 * signature » page and stored on the `contractSignatures` row. Measured before
 * the fix, as any signed-in account:
 *
 *     signAffiliateContract({ fullName, consented: true, signerIp: "8.8.8.8" })
 *       -> certificate reads « Adresse IP déclarée : 8.8.8.8 »
 *       -> contractSignatures.signerIp === "8.8.8.8"
 *
 * A row the signer chooses is not evidence of where the signer was, and it sat
 * next to rows that ARE evidence — the authenticated account, the server
 * timestamp, the SHA-256 digest of what was signed. This module is what makes
 * that row mean something: the Next server observes the address (a Convex
 * action cannot) and signs it, and Convex records only what verifies.
 *
 * These are the properties the Convex side depends on, tested without Convex.
 */

import { describe, expect, test } from "vitest";
import {
  MAX_IP_LENGTH,
  SIGNER_IP_ATTESTATION_SKEW_MS,
  SIGNER_IP_ATTESTATION_TTL_MS,
  SIGNER_IP_SECRET_ENV,
  SIGNER_IP_SECRET_MIN_LENGTH,
  attestationPayload,
  mintSignerIpAttestation,
  normaliseIp,
  readSignerIpSecret,
  verifySignerIpAttestation,
} from "../lib/security/signer-attestation";

const SECRET = "a".repeat(SIGNER_IP_SECRET_MIN_LENGTH);
const OTHER_SECRET = "b".repeat(SIGNER_IP_SECRET_MIN_LENGTH);
const NOW = 1_800_000_000_000;

const mint = (ip: string, now = NOW) =>
  mintSignerIpAttestation(ip, { secret: SECRET, now });

const verify = (
  attestation: Awaited<ReturnType<typeof mint>>,
  opts: { secret?: string | null; now?: number } = {},
) =>
  verifySignerIpAttestation(attestation, {
    secret: opts.secret === undefined ? SECRET : opts.secret,
    now: opts.now ?? NOW,
  });

describe("what the server observed comes back, and only that", () => {
  test("a freshly minted attestation verifies to the same address", async () => {
    const attestation = await mint("203.0.113.42");
    expect(attestation?.ip).toBe("203.0.113.42");
    await expect(verify(attestation)).resolves.toEqual({
      ip: "203.0.113.42",
      refusal: null,
    });
  });

  test("IPv6 survives the round trip untouched", async () => {
    const ip = "2001:db8::8a2e:370:7334";
    await expect(verify(await mint(ip))).resolves.toEqual({ ip, refusal: null });
  });

  /* The whole point. Everything below is a way of saying "the caller made this
     up", and each has to come back as no address rather than as an address. */
  test("an address the caller edited after minting is refused", async () => {
    const attestation = await mint("203.0.113.42");
    const forged = { ...attestation!, ip: "8.8.8.8" };
    await expect(verify(forged)).resolves.toEqual({
      ip: null,
      refusal: "bad_mac",
    });
  });

  test("an attestation invented from nothing is refused", async () => {
    await expect(
      verify({ ip: "8.8.8.8", issuedAt: NOW, mac: "0".repeat(64) }),
    ).resolves.toEqual({ ip: null, refusal: "bad_mac" });
  });

  test("one minted under another secret is refused", async () => {
    const attestation = await mintSignerIpAttestation("203.0.113.42", {
      secret: OTHER_SECRET,
      now: NOW,
    });
    await expect(verify(attestation)).resolves.toEqual({
      ip: null,
      refusal: "bad_mac",
    });
  });

  test("a date moved after minting is refused as forgery, not as staleness", async () => {
    /* `issuedAt` is inside what is signed, so an edited date fails the MAC.
       Answering « expired » would tell whoever sent it which half to fix. */
    const attestation = await mint("203.0.113.42");
    await expect(
      verify({ ...attestation!, issuedAt: NOW - 60_000 }),
    ).resolves.toEqual({ ip: null, refusal: "bad_mac" });
  });

  test("no attestation at all is not an address", async () => {
    await expect(verify(undefined)).resolves.toEqual({
      ip: null,
      refusal: "malformed",
    });
  });
});

describe("the address may not be pulled out of the payload", () => {
  /* The payload is length-delimited so two different observations cannot
     produce the same bytes. Without the length prefix, `("1.2.3", 4|…)` and
     `("1.2.3|4", …)` could collide and a MAC minted for one address would
     verify for another. */
  test("no two distinct observations share a payload", () => {
    expect(attestationPayload("1.2.3", 41)).not.toBe(
      attestationPayload("1.2.3|4", 1),
    );
    expect(attestationPayload("1.2.3.4", NOW)).toBe(
      attestationPayload("1.2.3.4", NOW),
    );
  });
});

describe("the window it is usable in", () => {
  test("still good just inside the TTL", async () => {
    const attestation = await mint("203.0.113.42");
    const verdict = await verify(attestation, {
      now: NOW + SIGNER_IP_ATTESTATION_TTL_MS,
    });
    expect(verdict.ip).toBe("203.0.113.42");
  });

  test("refused just outside it", async () => {
    const attestation = await mint("203.0.113.42");
    await expect(
      verify(attestation, { now: NOW + SIGNER_IP_ATTESTATION_TTL_MS + 1 }),
    ).resolves.toEqual({ ip: null, refusal: "expired" });
  });

  test("a second of clock skew does not throw the trail away", async () => {
    const attestation = await mint("203.0.113.42");
    const verdict = await verify(attestation, {
      now: NOW - SIGNER_IP_ATTESTATION_SKEW_MS,
    });
    expect(verdict.ip).toBe("203.0.113.42");
  });

  test("but a date well in the future is refused", async () => {
    const attestation = await mint("203.0.113.42");
    await expect(
      verify(attestation, { now: NOW - SIGNER_IP_ATTESTATION_SKEW_MS - 1 }),
    ).resolves.toEqual({ ip: null, refusal: "not_yet_valid" });
  });
});

describe("what may be signed at all", () => {
  test.each([
    ["a hostname", "evil.example.com"],
    ["a chain that was never split", "203.0.113.42, 10.0.0.1"],
    ["padding", "1".repeat(MAX_IP_LENGTH + 1)],
    ["nothing", ""],
    ["a newline smuggled in", "203.0.113.42\ninjected"],
  ])("%s is not an address and is not minted", async (_label, raw) => {
    expect(normaliseIp(raw)).toBeNull();
    await expect(mint(raw)).resolves.toBeNull();
  });

  test("a signed value that is not an address is still refused on the way back", async () => {
    /* Belt and braces: the mint side already refuses these, so reaching this
       needs the secret itself. It costs one regex and keeps free text off a
       legal document even then. */
    const issuedAt = NOW;
    const ip = "evil.example.com";
    const { mac } = (await mint("203.0.113.42"))!;
    await expect(verify({ ip, issuedAt, mac })).resolves.toEqual({
      ip: null,
      refusal: "malformed",
    });
  });
});

describe("a deployment with no secret", () => {
  test("mints nothing", async () => {
    await expect(
      mintSignerIpAttestation("203.0.113.42", { secret: null, now: NOW }),
    ).resolves.toBeNull();
  });

  test("verifies nothing, and says which half is missing", async () => {
    const attestation = await mint("203.0.113.42");
    await expect(verify(attestation, { secret: null })).resolves.toEqual({
      ip: null,
      refusal: "no_secret",
    });
  });

  test("a secret too short to be one counts as absent", () => {
    const short = "x".repeat(SIGNER_IP_SECRET_MIN_LENGTH - 1);
    expect(readSignerIpSecret({ [SIGNER_IP_SECRET_ENV]: short })).toBeNull();
    expect(readSignerIpSecret({ [SIGNER_IP_SECRET_ENV]: "  " })).toBeNull();
    expect(readSignerIpSecret({})).toBeNull();
    expect(readSignerIpSecret({ [SIGNER_IP_SECRET_ENV]: SECRET })).toBe(SECRET);
  });
});

/**
 * `/api/signer-ip` — the only half of the system that can see an address.
 *
 * It used to hand the page a bare `{ ip }` that the page passed to a public
 * Convex action as an argument, which is to say: it decorated a value the
 * caller could have invented. What it returns now is only useful to a signer
 * who really came from the address in it.
 */
describe("the route that observes the address", () => {
  const ask = async (headers: Record<string, string>) => {
    const { GET } = await import("../app/api/signer-ip/route");
    const res = await GET(new Request("https://beyours.fr/api/signer-ip", { headers }));
    return (await res.json()) as {
      attestation: { ip: string; issuedAt: number; mac: string } | null;
    };
  };

  const withSecret = async <T>(secret: string | undefined, body: () => Promise<T>) => {
    const saved = process.env[SIGNER_IP_SECRET_ENV];
    if (secret === undefined) delete process.env[SIGNER_IP_SECRET_ENV];
    else process.env[SIGNER_IP_SECRET_ENV] = secret;
    try {
      return await body();
    } finally {
      if (saved === undefined) delete process.env[SIGNER_IP_SECRET_ENV];
      else process.env[SIGNER_IP_SECRET_ENV] = saved;
    }
  };

  test("what it mints is what Convex accepts", async () => {
    const { attestation } = await withSecret(SECRET, () =>
      ask({ "x-forwarded-for": "203.0.113.42" }),
    );
    await expect(
      verifySignerIpAttestation(attestation, { secret: SECRET, now: Date.now() }),
    ).resolves.toEqual({ ip: "203.0.113.42", refusal: null });
  });

  test("it takes the client end of the proxy chain", async () => {
    /* Behind Vercel the first entry is the address the edge saw; the rest are
       the hops. Splitting is the whole reason a whole chain is refused by
       `normaliseIp` — an unsplit header would be signed as an "address". */
    const { attestation } = await withSecret(SECRET, () =>
      ask({ "x-forwarded-for": "203.0.113.42, 70.41.3.18, 150.172.238.178" }),
    );
    expect(attestation?.ip).toBe("203.0.113.42");
  });

  test("it falls back to x-real-ip", async () => {
    const { attestation } = await withSecret(SECRET, () =>
      ask({ "x-real-ip": "198.51.100.7" }),
    );
    expect(attestation?.ip).toBe("198.51.100.7");
  });

  test("no header, nothing to attest", async () => {
    const { attestation } = await withSecret(SECRET, () => ask({}));
    expect(attestation).toBeNull();
  });

  test("no secret, nothing to attest", async () => {
    const { attestation } = await withSecret(undefined, () =>
      ask({ "x-forwarded-for": "203.0.113.42" }),
    );
    expect(attestation).toBeNull();
  });

  test("it never signs something that is not an address", async () => {
    const { attestation } = await withSecret(SECRET, () =>
      ask({ "x-forwarded-for": "evil.example.com" }),
    );
    expect(attestation).toBeNull();
  });
});
