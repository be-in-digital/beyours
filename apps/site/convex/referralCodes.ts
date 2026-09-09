import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  deriveDiscountPercent,
  isBillableDiscountPercent,
  requireBillableDiscountPercent,
} from "./referralDiscount";
import { Doc, Id } from "./_generated/dataModel";
import {
  affiliateStandingRefusal,
  isUngrandfathered,
  type StandingRefusal,
} from "./affiliateStanding";
import { affiliateProgramEnabled } from "./affiliateSettings";
import { PROGRAM_DISABLED_REASON } from "./affiliateProgram";

/* ── Helpers ── */

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BID-";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function isValidCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{3,20}$/.test(code);
}

/* ── The one lookup ──
   `validateCode` (what the storefront shows) and `resolveForCheckout` (what
   the customer is charged) must never be able to disagree about a code, so
   they walk the same three checks here rather than each keeping its own copy.
   Returns the code row AND its owner, because the owner is what decides both
   the discount and who gets the commission — the checkout used to take that
   id from the caller. */
async function lookupUsableCode(
  ctx: QueryCtx,
  rawCode: string,
): Promise<{ code: Doc<"referralCodes">; affiliate: Doc<"affiliateUsers"> } | null> {
  /* The kill-switch, first: it is about the PROGRAMME, so it does not depend on
     which code was typed or who owns it. Refusing here is what makes it reach
     both readers at once — `validateCode` answers « invalide » and
     `resolveForCheckout` answers `null`, so the checkout bills the list price
     exactly as it would for a code nobody holds. `programEnabled` had no reader
     at all on this path; see ./affiliateProgram for what it now stops. */
  if (!(await affiliateProgramEnabled(ctx))) {
    console.log(`[REFERRAL] ${PROGRAM_DISABLED_REASON} — code refusé.`);
    return null;
  }

  const normalizedCode = rawCode.toUpperCase().trim();

  const referralCode = await ctx.db
    .query("referralCodes")
    .withIndex("by_code", (q) => q.eq("code", normalizedCode))
    .unique();
  if (!referralCode || !referralCode.isActive) return null;

  const affiliate = await ctx.db.get(referralCode.affiliateUserId);
  if (!affiliate) return null;

  /* `status` is about the ACCOUNT; the contract is what makes a commission
     payable, and it used to be checked nowhere on this path. Any signed-in
     account can grant itself `status: "active"` through the public
     `affiliateUsers.createAfterSignup`, so asking only that made the whole
     programme self-service: sign up, mint a code, take 750 € off a friend's
     build and accrue a 500 € commission with nothing signed. See
     ./affiliateStanding. */
  const refusal = affiliateStandingRefusal(affiliate);
  if (refusal) {
    console.log(
      `[REFERRAL] Code « ${referralCode.code} » inutilisable : ${refusal}.`,
    );
    return null;
  }

  /* Permitted, but worth saying out loud: this row predates the contract
     system and the front end already refuses it a dashboard. Running
     `migrations.addContractStatusToAffiliates` is what settles it either way. */
  if (isUngrandfathered(affiliate)) {
    console.error(
      `[REFERRAL] L'apporteur ${affiliate._id} n'a pas de contractStatus — ` +
        `accepté au titre de l'antériorité. Lancer ` +
        `migrations.addContractStatusToAffiliates pour régulariser.`,
    );
  }

  return { code: referralCode, affiliate };
}

/* ── Who may hold a code ──

   `lookupUsableCode` refuses to price a code whose owner has not signed, which
   closed the money half of the self-service hole. This closes the other half:
   minting the code in the first place. Both public mutations below asked only
   for an affiliate profile, and `affiliateUsers.createAfterSignup` hands one to
   any signed-in account — so an unsigned account could still mint « BID-XXXXX »,
   publish it, and hand out a code that silently prices at nothing. The refusal
   belongs where the code is created, not only where it is read.

   The message names the reason: the contract page is one click away, and « code
   invalide » would send the affiliate to support instead. */
const CODE_REFUSALS: Record<StandingRefusal, string> = {
  account_not_active:
    "Votre compte apporteur n'est pas actif : contactez-nous avant de générer un code.",
  contract_pending:
    "Signez le contrat d'apporteur d'affaires avant de générer un code de parrainage.",
  contract_superseded:
    "Une nouvelle version du contrat est à signer avant de générer un code de parrainage.",
};

/* ── What a refused mint should do to the caller ──
   Two callers, two right answers, and the gap between them is what let a
   suspended affiliate keep a code. See {@link mintCodeFor}. */
export type MintRefusalPolicy =
  /* Somebody pressed a button. Tell them why, in French, with the fix one
     click away. */
  | "throw"
  /* Nobody pressed anything: a signature is being recorded. The signature is
     valid and must stand; the code is simply not minted. */
  | "skip";

function assertMayHoldACode(affiliate: Doc<"affiliateUsers">): void {
  const refusal = affiliateStandingRefusal(affiliate);
  if (refusal) throw new Error(CODE_REFUSALS[refusal]);
}

/* ── Minting, in one place, gated in that one place ──
   Two callers: `generateMyCode` below, and `contractSignatures
   .recordInAppSignature` at the moment a signature activates an affiliate.
   The second exists BECAUSE of the refusal above. The code was minted at
   signup — `/parrainage/inscription` called `generateMyCode` between
   `createAfterSignup` and the redirect to the contract page — which is
   `pending_contract`, which `assertMayHoldACode` now refuses. Gating the mint
   without moving it left every new affiliate signed, activated and holding no
   code at all, with nothing in the dashboard able to create one.

   And moving it is what re-opened the hole it was closing. `assertMayHoldACode`
   sat in the CALLER, so the caller added afterwards inherited nothing: the
   signature path's only condition was that the version signed was the one
   required. `status` and `contractStatus` are independent — `admin
   .updateAffiliateStatus` patches only the first — so a SUSPENDED affiliate
   who signed came out `status: "suspended"`, `contractStatus: "active"`,
   holding a live code. `lookupUsableCode` refuses to price it, so no money
   moved; but a suspended apporteur was still handed a code to publish, and
   the docstring above claims this half is closed.

   The rule now lives HERE, once, evaluated against the affiliate as this
   transaction has left them — re-read from the db rather than taken from the
   caller, because `recordInAppSignature` patches `contractStatus: "active"`
   immediately before calling and its own copy of the row is one write stale.
   A pending-contract affiliate therefore still gets their code at the moment
   they sign, and a suspended one does not.

   `policy` is REQUIRED, with no default, so a third caller has to decide what
   a refusal means to it rather than inheriting a silence — which is precisely
   how the second caller got here.

   Deliberately NOT gated on `programEnabled`: `generateMyCode` is not either,
   and the two paths that mint have to agree. See ./affiliateProgram for what
   the switch does gate — pricing a code, accruing a commission, paying one.

   Idempotent: an affiliate already holding an active code gets that one back,
   so re-signing a superseded contract version mints no second code and does
   not disturb a custom one they have been publishing. The standing check comes
   FIRST even so: a code an affiliate may no longer hold is not one to hand
   back, and returning it would make suspension depend on when they signed. */
export async function mintCodeFor(
  ctx: MutationCtx,
  affiliateUserId: Id<"affiliateUsers">,
  policy: MintRefusalPolicy,
): Promise<Doc<"referralCodes"> | null> {
  const affiliate = await ctx.db.get(affiliateUserId);
  if (!affiliate) throw new Error("Profil apporteur introuvable");

  const refusal = affiliateStandingRefusal(affiliate);
  if (refusal) {
    if (policy === "throw") throw new Error(CODE_REFUSALS[refusal]);
    console.log(
      `[REFERRAL] Aucun code émis pour l'apporteur ${affiliateUserId} : ${refusal}.`,
    );
    return null;
  }

  const existing = await ctx.db
    .query("referralCodes")
    .withIndex("by_affiliateUserId", (q) =>
      q.eq("affiliateUserId", affiliateUserId),
    )
    .filter((q) => q.eq(q.field("isActive"), true))
    .unique();
  if (existing) return existing;

  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    const taken = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!taken) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    throw new Error("Impossible de générer un code unique");
  }

  const codeId = await ctx.db.insert("referralCodes", {
    affiliateUserId,
    code,
    isCustom: false,
    isActive: true,
    createdAt: Date.now(),
  });

  return await ctx.db.get(codeId);
}

/** The programme-wide discount, or `undefined` when no settings row exists. */
async function settingsDiscountPercent(
  ctx: QueryCtx,
): Promise<number | undefined> {
  const settings = await ctx.db.query("affiliateSettings").take(1);
  return settings[0]?.defaultDiscountPercent;
}

/* ── Public queries ── */

export const getMyCode = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return null;

    return await ctx.db
      .query("referralCodes")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();
  },
});

/* Public and unauthenticated on purpose: affiliate codes are handed out to be
   typed in by strangers, so the storefront has to be able to price one before
   anybody signs in. What changed is what the answer is FOR — it is now a
   display value only. `createCheckoutSession` no longer accepts a percent, an
   affiliate id or a code id from its caller; it repeats this lookup itself.
   Forging the reply here therefore changes what the page draws and nothing
   about what is charged. */
export const validateCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const found = await lookupUsableCode(ctx, args.code);
    if (!found) {
      return { valid: false, error: "Code invalide ou désactivé" };
    }

    /* Bounded with the SAME rule the checkout applies. Without this the two
       could still disagree in one direction: a misconfigured percent (an admin
       typo in `defaultDiscountPercent`, which `admin.updateSettings` stores
       unchecked) was advertised here as a valid code and then hard-refused at
       payment. Telling a customer their code is good and then failing the sale
       is worse than declining it up front. */
    const percent = deriveDiscountPercent({
      overridePercent: found.affiliate.discountOverridePercent,
      settingsPercent: await settingsDiscountPercent(ctx),
    });
    if (!isBillableDiscountPercent(percent)) {
      console.error(
        `[REFERRAL] Le code « ${found.code.code} » vaut ${percent} %, hors de ` +
          `l'intervalle facturable : présenté comme invalide au client. ` +
          `Corriger defaultDiscountPercent des réglages ou ` +
          `discountOverridePercent de l'apporteur.`,
      );
      return { valid: false, error: "Code invalide ou désactivé" };
    }

    return {
      valid: true,
      code: found.code.code,
      referralCodeId: found.code._id,
      affiliateUserId: found.affiliate._id,
      discountPercent: percent,
    };
  },
});

/* ── Public mutations ── */

export const generateMyCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");
    /* Kept, though `mintCodeFor` now applies the same rule from the same map:
       this refuses BEFORE the mint is attempted, which is what keeps the
       message and the behaviour of this mutation exactly what they were. */
    assertMayHoldACode(affiliate);

    /* Still public, and now the RECOVERY path rather than the normal one: the
       signature mints the code (./contractSignatures.ts). This is what a
       signed affiliate holding none — a mint that failed, or one that predates
       it moving — presses in the dashboard. */
    return await mintCodeFor(ctx, affiliate._id, "throw");
  },
});

export const customizeMyCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");
    assertMayHoldACode(affiliate);

    const normalizedCode = args.code.toUpperCase().trim();

    if (!isValidCode(normalizedCode)) {
      throw new Error(
        "Le code doit contenir entre 3 et 20 caractères alphanumériques",
      );
    }

    // Make sure the code is not already taken
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", normalizedCode))
      .unique();
    if (existing) {
      throw new Error("Ce code est déjà utilisé");
    }

    // Deactivate the previously active code
    const currentCode = await ctx.db
      .query("referralCodes")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();
    if (currentCode) {
      await ctx.db.patch(currentCode._id, { isActive: false });
    }

    // Create the new custom code
    const codeId = await ctx.db.insert("referralCodes", {
      affiliateUserId: affiliate._id,
      code: normalizedCode,
      isCustom: true,
      isActive: true,
      createdAt: Date.now(),
    });

    return await ctx.db.get(codeId);
  },
});

/* ── Internal queries ── */

export const getByCode = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase().trim()))
      .unique();
  },
});

/**
 * The affiliate a code belongs to, or `null`.
 *
 * Used by the webhook to check that the referrer named in a session's metadata
 * really owns the code named beside it. The checkout writes both, so they
 * agree by construction today — but a Stripe session lives up to 24 h, so any
 * session opened before `createCheckoutSession` stopped accepting a caller's
 * `referrerId` still carries whatever that caller chose. This is what stops
 * one of those paying out.
 */
export const ownerOf = internalQuery({
  args: { referralCodeId: v.id("referralCodes") },
  handler: async (ctx, args): Promise<Id<"affiliateUsers"> | null> => {
    const code = await ctx.db.get(args.referralCodeId);
    return code?.affiliateUserId ?? null;
  },
});

/* ── What a referral code is worth, for the checkout ──
   The three values `createCheckoutSession` used to accept from its caller —
   the code id, the affiliate who earns the commission, and the percent off —
   all come from here now. The customer supplies the code string and nothing
   else, so there is no longer an argument to forge: a wrong code resolves to
   `null` and the sale is billed at list price.

   `internalQuery`, so no client can reach it and hand itself a different
   answer than the one the checkout computed. */
export const resolveForCheckout = internalQuery({
  args: { code: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    referralCodeId: Id<"referralCodes">;
    referrerId: Id<"affiliateUsers">;
    referrerEmail: string | null;
    discountPercent: number;
  } | null> => {
    const found = await lookupUsableCode(ctx, args.code);
    if (!found) return null;

    /* Throws rather than returns on an out-of-range percent: that is a
       misconfiguration, not an invalid code, and the two must not read the
       same to the customer. See ./referralDiscount. */
    const discountPercent = requireBillableDiscountPercent({
      overridePercent: found.affiliate.discountOverridePercent,
      settingsPercent: await settingsDiscountPercent(ctx),
      code: found.code.code,
    });

    /* The affiliate's own email, read here so the checkout's anti-self-referral
       check compares against the owner of THIS code rather than against an
       affiliate id the caller chose. */
    const user = await ctx.db.get(found.affiliate.userId);

    return {
      referralCodeId: found.code._id,
      referrerId: found.affiliate._id,
      referrerEmail: user?.email ?? null,
      discountPercent,
    };
  },
});
