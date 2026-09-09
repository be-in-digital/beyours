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
 * The HMAC was only half of it, and the half it left open is the one the
 * certificate actually claims. A MAC proves INTEGRITY: nobody edited the
 * address after minting. « Adresse IP constatée », under a note reading
 * « relevés par les serveurs de Be in Digital, jamais transmis par le
 * signataire », claims PROVENANCE. `/api/signer-ip` read plain
 * `x-forwarded-for` and signed its client end — the end a client writes — so
 * nobody ever had to forge a MAC. Measured before this fix:
 *
 *     GET /api/signer-ip   with the caller's own `x-forwarded-for: 8.8.8.8`
 *       -> {"ip":"8.8.8.8","issuedAt":…,"mac":"7c9d0a71…"}
 *       -> Convex verdict {"ip":"8.8.8.8","refusal":null}
 *       -> certificate « Adresse IP constatée : 8.8.8.8 »
 *
 * So the address is read only from a header the platform edge writes, and WHICH
 * header is inside the signed bytes (payload v2) so it cannot be relabelled.
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
  TRUSTED_SIGNER_IP_HEADERS,
  attestationPayload,
  isTrustedSignerIpSource,
  mintSignerIpAttestation,
  normaliseIp,
  observeSignerIp,
  readSignerIpSecret,
  verifySignerIpAttestation,
  type SignerIpSource,
} from "../lib/security/signer-attestation";

const SECRET = "a".repeat(SIGNER_IP_SECRET_MIN_LENGTH);
const OTHER_SECRET = "b".repeat(SIGNER_IP_SECRET_MIN_LENGTH);
const NOW = 1_800_000_000_000;

/** The header the Vercel edge writes. Nothing else mints. */
const EDGE: SignerIpSource = "x-vercel-forwarded-for";

const mint = (ip: string, now = NOW, source: SignerIpSource = EDGE) =>
  mintSignerIpAttestation({ ip, source }, { secret: SECRET, now });

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
      source: EDGE,
      refusal: null,
    });
  });

  test("IPv6 survives the round trip untouched", async () => {
    const ip = "2001:db8::8a2e:370:7334";
    await expect(verify(await mint(ip))).resolves.toEqual({
      ip,
      source: EDGE,
      refusal: null,
    });
  });

  /* The whole point. Everything below is a way of saying "the caller made this
     up", and each has to come back as no address rather than as an address. */
  test("an address the caller edited after minting is refused", async () => {
    const attestation = await mint("203.0.113.42");
    const forged = { ...attestation!, ip: "8.8.8.8" };
    await expect(verify(forged)).resolves.toEqual({
      ip: null,
      source: null,
      refusal: "bad_mac",
    });
  });

  test("an attestation invented from nothing is refused", async () => {
    /* Everything plausible — a real address, a real date, a trusted source —
       and a MAC made up. That is the one the key exists to catch. (Invented
       WITHOUT a source is refused a step earlier; see « a v1 attestation »
       below.) */
    await expect(
      verify({ ip: "8.8.8.8", issuedAt: NOW, mac: "0".repeat(64), source: EDGE }),
    ).resolves.toEqual({ ip: null, source: null, refusal: "bad_mac" });
  });

  test("one minted under another secret is refused", async () => {
    const attestation = await mintSignerIpAttestation(
      { ip: "203.0.113.42", source: EDGE },
      { secret: OTHER_SECRET, now: NOW },
    );
    await expect(verify(attestation)).resolves.toEqual({
      ip: null,
      source: null,
      refusal: "bad_mac",
    });
  });

  test("a date moved after minting is refused as forgery, not as staleness", async () => {
    /* `issuedAt` is inside what is signed, so an edited date fails the MAC.
       Answering « expired » would tell whoever sent it which half to fix. */
    const attestation = await mint("203.0.113.42");
    await expect(
      verify({ ...attestation!, issuedAt: NOW - 60_000 }),
    ).resolves.toEqual({ ip: null, source: null, refusal: "bad_mac" });
  });

  test("no attestation at all is not an address", async () => {
    await expect(verify(undefined)).resolves.toEqual({
      ip: null,
      source: null,
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
    expect(attestationPayload("1.2.3", 41, EDGE)).not.toBe(
      attestationPayload("1.2.3|4", 1, EDGE),
    );
    expect(attestationPayload("1.2.3.4", NOW, EDGE)).toBe(
      attestationPayload("1.2.3.4", NOW, EDGE),
    );
  });

  /* The source is length-delimited for the same reason and joins the same
     guarantee: the header an address was observed in cannot be slid into the
     address, nor the address into the header. */
  test("the source cannot be smuggled into the address either", () => {
    expect(attestationPayload("1.2.3.4", NOW, "x-real-ip")).not.toBe(
      attestationPayload("1.2.3.4", NOW, "x-vercel-forwarded-for"),
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
    ).resolves.toEqual({ ip: null, source: null, refusal: "expired" });
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
    ).resolves.toEqual({ ip: null, source: null, refusal: "not_yet_valid" });
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
    await expect(verify({ ip, issuedAt, mac, source: EDGE })).resolves.toEqual({
      ip: null,
      source: null,
      refusal: "malformed",
    });
  });
});

describe("a deployment with no secret", () => {
  test("mints nothing", async () => {
    await expect(
      mintSignerIpAttestation(
        { ip: "203.0.113.42", source: EDGE },
        { secret: null, now: NOW },
      ),
    ).resolves.toBeNull();
  });

  test("verifies nothing, and says which half is missing", async () => {
    const attestation = await mint("203.0.113.42");
    await expect(verify(attestation, { secret: null })).resolves.toEqual({
      ip: null,
      source: null,
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
 *
 * And it is the route, not the crypto, that decides whether that is true. This
 * block used to contain a test called « it takes the client end of the proxy
 * chain », asserting that a bare `x-forwarded-for` produced an attestation, on
 * the stated assumption that « behind Vercel the first entry is the address the
 * edge saw ». Nothing in the route established that the request had been behind
 * Vercel at all: no trusted-proxy allow-list existed anywhere in the repository
 * (`x-vercel-forwarded-for|request.ip|trustProxy` matched zero lines), so the
 * first entry was equally the first thing a caller typed. The test was green,
 * and it was blessing the defect. It is replaced by the two below.
 */
describe("the route that observes the address", () => {
  const ask = async (headers: Record<string, string>) => {
    const { GET } = await import("../app/api/signer-ip/route");
    const res = await GET(new Request("https://beyours.fr/api/signer-ip", { headers }));
    return (await res.json()) as {
      attestation: {
        ip: string;
        issuedAt: number;
        mac: string;
        source: string;
      } | null;
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
      ask({ "x-vercel-forwarded-for": "203.0.113.42" }),
    );
    await expect(
      verifySignerIpAttestation(attestation, { secret: SECRET, now: Date.now() }),
    ).resolves.toEqual({
      ip: "203.0.113.42",
      source: "x-vercel-forwarded-for",
      refusal: null,
    });
  });

  /* ── The defect, and it is the certificate's whole claim ──
     `signAffiliateContract` stopped taking a raw `signerIp`, so forging the
     « Adresse IP constatée » row needs a MAC — which the attacker has no key
     for. They do not need one. They ask the oracle. Measured on the route
     before this fix, with no proxy anywhere near the request:

         curl -H 'x-forwarded-for: 8.8.8.8' /api/signer-ip
           -> {"ip":"8.8.8.8","issuedAt":1788914879187,"mac":"7c9d0a71…"}
           -> Convex verdict {"ip":"8.8.8.8","refusal":null}

     A signed lie is still a lie; the signature only guarantees nobody edited
     it afterwards. The document says the address was « relevé par les serveurs
     de Be in Digital, jamais transmis par le signataire », so a value the
     signer transmitted may not reach that row by any path. */
  test("a caller who writes their own x-forwarded-for gets nothing", async () => {
    const { attestation } = await withSecret(SECRET, () =>
      ask({ "x-forwarded-for": "8.8.8.8" }),
    );
    expect(attestation).toBeNull();
  });

  test("nor by hiding behind a chain, nor by outranking the edge", async () => {
    /* Two shapes of the same attempt. A chain, whose client end is the part
       the caller writes; and a chain sent ALONGSIDE the real edge header, in
       case the route preferred the longer answer. */
    const { attestation: chained } = await withSecret(SECRET, () =>
      ask({ "x-forwarded-for": "8.8.8.8, 70.41.3.18, 150.172.238.178" }),
    );
    expect(chained).toBeNull();

    const { attestation: alongside } = await withSecret(SECRET, () =>
      ask({
        "x-forwarded-for": "8.8.8.8",
        "x-vercel-forwarded-for": "203.0.113.42",
      }),
    );
    expect(alongside?.ip).toBe("203.0.113.42");
    expect(alongside?.source).toBe("x-vercel-forwarded-for");
  });

  test("the platform's header outranks x-real-ip", async () => {
    /* Both are written by the edge, so both mint; the order is fixed so that
       « which one did this come from » has one answer, not the caller's pick. */
    const { attestation } = await withSecret(SECRET, () =>
      ask({
        "x-real-ip": "198.51.100.7",
        "x-vercel-forwarded-for": "203.0.113.42",
      }),
    );
    expect(attestation?.ip).toBe("203.0.113.42");
    expect(attestation?.source).toBe("x-vercel-forwarded-for");
  });

  test("it falls back to x-real-ip", async () => {
    const { attestation } = await withSecret(SECRET, () =>
      ask({ "x-real-ip": "198.51.100.7" }),
    );
    expect(attestation?.ip).toBe("198.51.100.7");
    expect(attestation?.source).toBe("x-real-ip");
  });

  test("the edge's own header is still split, and its first entry taken", async () => {
    /* A proxy chained BEHIND the edge appends its hops to the right, so the
       leftmost entry stays the one the trusted hop wrote. An unsplit chain
       would fail `normaliseIp` and throw the row away for no reason. */
    const { attestation } = await withSecret(SECRET, () =>
      ask({ "x-vercel-forwarded-for": "203.0.113.42, 10.0.0.1" }),
    );
    expect(attestation?.ip).toBe("203.0.113.42");
  });

  test("no header, nothing to attest", async () => {
    const { attestation } = await withSecret(SECRET, () => ask({}));
    expect(attestation).toBeNull();
  });

  test("no secret, nothing to attest", async () => {
    const { attestation } = await withSecret(undefined, () =>
      ask({ "x-vercel-forwarded-for": "203.0.113.42" }),
    );
    expect(attestation).toBeNull();
  });

  test("it never signs something that is not an address", async () => {
    const { attestation } = await withSecret(SECRET, () =>
      ask({ "x-vercel-forwarded-for": "evil.example.com" }),
    );
    expect(attestation).toBeNull();
  });

  test("a trusted header holding rubbish does not fall through to the next", async () => {
    /* The edge wrote something unusable. That is a broken observation, not an
       invitation to go looking for a more agreeable header — least of all one
       further down the trust order that a caller might also have set. */
    const { attestation } = await withSecret(SECRET, () =>
      ask({
        "x-vercel-forwarded-for": "evil.example.com",
        "x-real-ip": "8.8.8.8",
      }),
    );
    expect(attestation).toBeNull();
  });
});

/**
 * The source travels inside the MAC, not beside it.
 *
 * Signing the address alone would have left the label free: an attestation
 * honestly minted from one header could be re-presented as though it came from
 * another, and the point of naming the source is that the certificate can say
 * « constatée » only when it was.
 */
describe("provenance is part of what is signed", () => {
  test("relabelling an attestation breaks its MAC", async () => {
    const honest = await mint("203.0.113.42", NOW, "x-real-ip");
    await expect(
      verify({ ...honest!, source: "x-vercel-forwarded-for" }),
    ).resolves.toEqual({ ip: null, source: null, refusal: "bad_mac" });
  });

  test("an attestation naming an untrusted header is refused, MAC or no MAC", async () => {
    /* Reachable only with the secret itself, or by an entry leaving
       TRUSTED_SIGNER_IP_HEADERS after minting. Refused either way, and named
       as what it is rather than as a forgery. */
    const forged = {
      ...(await mint("203.0.113.42"))!,
      source: "x-forwarded-for",
    };
    await expect(verify(forged)).resolves.toEqual({
      ip: null,
      source: null,
      refusal: "untrusted_source",
    });
  });

  test("a v1 attestation, carrying no source at all, is refused", async () => {
    /* What a browser holding the previous bundle sends across a deploy. It
       degrades to « adresse non établie » — the version bump doing its job.
       The Convex validator keeps `source` optional precisely so this lands
       here, as a lost audit row, instead of failing the whole signature. */
    const { ip, issuedAt, mac } = (await mint("203.0.113.42"))!;
    await expect(verify({ ip, issuedAt, mac })).resolves.toEqual({
      ip: null,
      source: null,
      refusal: "untrusted_source",
    });
  });

  test("the trusted set is exactly what the observer reads", () => {
    /* One named place. `observeSignerIp` is the only reader of request headers
       in this system, and this is the list it reads — so adding a host's edge
       header is one edit, and a header not on the list cannot become an
       observation by any other route. */
    expect(TRUSTED_SIGNER_IP_HEADERS).toEqual([
      "x-vercel-forwarded-for",
      "x-real-ip",
    ]);
    expect(isTrustedSignerIpSource("x-forwarded-for")).toBe(false);
    expect(isTrustedSignerIpSource(undefined)).toBe(false);
    for (const header of TRUSTED_SIGNER_IP_HEADERS) {
      expect(isTrustedSignerIpSource(header)).toBe(true);
      expect(
        observeSignerIp(new Headers({ [header]: "203.0.113.42" })),
      ).toEqual({ ip: "203.0.113.42", source: header });
    }
    expect(
      observeSignerIp(new Headers({ "x-forwarded-for": "203.0.113.42" })),
    ).toBeNull();
  });
});
