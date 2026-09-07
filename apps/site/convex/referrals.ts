import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { SITE_SUBJECT, consumeRateLimit } from "./rateLimit";
import {
  affiliateProgramEnabled,
  readAffiliateSettings,
} from "./affiliateSettings";
import { PROGRAM_DISABLED_REASON } from "./affiliateProgram";
import {
  affiliateStandingRefusal,
  isUngrandfathered,
} from "./affiliateStanding";

/* ── Internal queries ── */

export const getByOrderId = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .unique();
  },
});

/* ── Internal mutations ── */

export const createFromCheckout = internalMutation({
  args: {
    referrerId: v.id("affiliateUsers"),
    referralCodeId: v.id("referralCodes"),
    orderId: v.id("orders"),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    commissionCents: v.number(),
    discountPercent: v.number(),
    discountAmountCents: v.number(),
  },
  handler: async (ctx, args) => {
    // Idempotent: one referral per order
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .unique();
    if (existing) return existing._id;

    /* ── The programme's kill-switch ──
       A Stripe session stays payable for up to 24 h, so a sale discounted
       while the programme was on can settle after it has been switched off:
       `resolveForCheckout` refuses the code at checkout, but this runs from the
       webhook, against metadata written before the switch was thrown. The
       commission is therefore RECORDED and held rather than dropped — the
       customer did get the discount, and losing that fact would leave nothing
       for an operator to reconcile — but it never reaches a state any payout
       path reads. See ./affiliateProgram. */
    const programOff = !(await affiliateProgramEnabled(ctx));
    if (programOff) {
      console.error(
        `[REFERRAL] ${PROGRAM_DISABLED_REASON} — commission de la commande ` +
          `${args.orderId} enregistrée bloquée, à arbitrer manuellement.`,
      );
    }

    // « Nouveau Client » dedup (art. 3.2): if the email is already a customer (an
    // earlier paid order) or an already-known contact, hold it for human review
    // instead of letting the commission through.
    const priorOrders = await ctx.db
      .query("orders")
      .withIndex("by_email", (q) => q.eq("customerEmail", args.customerEmail))
      .take(10);
    const hadPriorPaidOrder = priorOrders.some(
      (o) => o._id !== args.orderId && o.status === "paid",
    );
    const knownLead = await ctx.db
      .query("contactLeads")
      .withIndex("by_email", (q) => q.eq("email", args.customerEmail))
      .take(1);
    const alreadyKnown = hadPriorPaidOrder || knownLead.length > 0;

    const now = Date.now();
    const flagged = programOff
      ? {
          status: "blocked" as const,
          blockedAt: now,
          statusReason: PROGRAM_DISABLED_REASON,
          adminNote:
            "Session de paiement ouverte avant la désactivation du programme : " +
            "la remise a été accordée, la commission reste à arbitrer.",
        }
      : alreadyKnown
        ? {
            status: "blocked" as const,
            blockedAt: now,
            statusReason:
              "Client potentiellement déjà connu — vérifier l'éligibilité « Nouveau Client » (art. 3.2)",
            adminNote: hadPriorPaidOrder
              ? "Commande antérieure payée avec le même email."
              : "Email déjà présent dans les contacts (lead).",
          }
        : { status: "pending" as const };

    return await ctx.db.insert("referrals", {
      referrerId: args.referrerId,
      referralCodeId: args.referralCodeId,
      orderId: args.orderId,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      ...flagged,
      commissionCents: args.commissionCents,
      discountPercent: args.discountPercent,
      discountAmountCents: args.discountAmountCents,
      createdAt: now,
    });
  },
});

export const validatePendingReferrals = internalMutation({
  args: {},
  handler: async (ctx) => {
    /* Deliberately NOT gated on `programEnabled`: this step moves no money, it
       only ages a commission that was already accrued, and freezing it would
       silently rewrite what is owed for work already done. The two gates that
       matter are `markValidatedAsPayable` and `processPayouts` below. */
    const { validationDelayDays } = await readAffiliateSettings(ctx);
    const cutoff = Date.now() - validationDelayDays * 24 * 60 * 60 * 1000;

    const pendingReferrals = await ctx.db
      .query("referrals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(100);

    let validated = 0;
    for (const referral of pendingReferrals) {
      if (referral.createdAt <= cutoff) {
        const order = await ctx.db.get(referral.orderId);
        if (order && order.status === "paid") {
          await ctx.db.patch(referral._id, {
            status: "validated",
            validatedAt: Date.now(),
          });
          validated++;
        } else if (
          order &&
          (order.status === "cancelled" || order.status === "failed")
        ) {
          await ctx.db.patch(referral._id, {
            status: "cancelled",
            cancelledAt: Date.now(),
            statusReason: "Commande annulée ou échouée",
          });
        }
      }
    }

    if (validated > 0) {
      console.log(`Validated ${validated} referrals`);
    }
  },
});

export const getPayableReferrals = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_status", (q) => q.eq("status", "payable"))
      .take(100);
  },
});

/**
 * Moves `validated` commissions to `payable` — the last state before money
 * actually leaves.
 *
 * Two gates were missing here and both let money out.
 *
 * The KILL-SWITCH. `programEnabled` was read by nothing: an operator who
 * switched the programme off on Sunday still had commissions marked payable at
 * 03:30 and wired at 10:00 on Monday.
 *
 * The CONTRACT. This asked for Stripe Connect, a SIRET and an invoice — three
 * questions about how to pay someone, and none about whether they are owed
 * anything. `affiliateUsers.createAfterSignup` is public and hands any
 * signed-in account `status: "active"`, so the account check that WAS here
 * proved nothing; the affiliate contract is the legal basis for the commission
 * (art. 4), and it went unchecked all the way to the transfer. The rule is the
 * one ./affiliateStanding already states for the discount half, deliberately
 * shared: the code that discounts a sale and the cron that pays for it must not
 * be able to disagree about who is in good standing.
 */
export const markValidatedAsPayable = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!(await affiliateProgramEnabled(ctx))) {
      console.log(`[REFERRAL] ${PROGRAM_DISABLED_REASON} — aucun paiement dû.`);
      return;
    }

    const validated = await ctx.db
      .query("referrals")
      .withIndex("by_status", (q) => q.eq("status", "validated"))
      .take(100);

    let marked = 0;
    for (const referral of validated) {
      const affiliate = await ctx.db.get(referral.referrerId);
      if (!affiliate) continue;

      // The contract, before anything about how to pay (art. 4).
      const refusal = affiliateStandingRefusal(affiliate);
      if (refusal) {
        console.log(
          `[REFERRAL] Commission ${referral._id} non payable : ${refusal}.`,
        );
        continue;
      }
      if (isUngrandfathered(affiliate)) {
        console.error(
          `[REFERRAL] L'apporteur ${affiliate._id} n'a pas de contractStatus — ` +
            `commission ${referral._id} rendue payable au titre de ` +
            `l'antériorité. Lancer migrations.addContractStatusToAffiliates.`,
        );
      }

      // No payout without a SIRET (professional) and the affiliate's invoice (art. 4.2).
      if (
        affiliate.stripeConnectStatus === "active" &&
        affiliate.siret &&
        referral.invoiceStorageId
      ) {
        await ctx.db.patch(referral._id, { status: "payable" });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`Marked ${marked} referrals as payable`);
    }
  },
});

/**
 * Claims a payable commission for one payout run, or refuses.
 *
 * WHY. `processPayouts` transferred first and marked paid afterwards, with no
 * key on the transfer. Two overlapping runs — and the cron is Mon+Thu, so a
 * retry overlapping a run is not hypothetical — both read the same referral as
 * payable and both called `transfers.create`: one commission, wired twice, one
 * transfer id orphaned because only the second was recorded (#322).
 *
 * The claim is the first of two guards. It is a mutation, so it is
 * serializable: of two runs reaching the same row, exactly one sees `payable`
 * and the other is refused. The second guard is the idempotency key on the
 * transfer itself, which covers the case this cannot — the same run retried
 * after dying between the claim and the transfer.
 *
 * Returns whether the caller now owns the payout. Never throws: a refusal is
 * an ordinary outcome of two runs meeting, not an error.
 */
export const claimForPayout = internalMutation({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args): Promise<boolean> => {
    const referral = await ctx.db.get(args.referralId);
    if (!referral || referral.status !== "payable") return false;
    await ctx.db.patch(args.referralId, { status: "paying" });
    return true;
  },
});

/**
 * Hands a claimed commission back when the payout did not happen.
 *
 * Without this a failed transfer would strand the row in `paying`, where no
 * run looks — the affiliate would simply never be paid, and nothing would say
 * so. Only ever moves `paying` back, so a row that reached `paid` in the
 * meantime is left alone.
 */
export const releasePayoutClaim = internalMutation({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    const referral = await ctx.db.get(args.referralId);
    if (referral?.status !== "paying") return;
    await ctx.db.patch(args.referralId, { status: "payable" });
  },
});

export const markPaid = internalMutation({
  args: {
    referralId: v.id("referrals"),
    stripeTransferId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.referralId, {
      status: "paid",
      paidAt: Date.now(),
      stripeTransferId: args.stripeTransferId,
    });
  },
});

export const getByIdInternal = internalQuery({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.referralId);
  },
});

/**
 * Cancels a commission (refund, unpaid invoice, dispute). Reversing the Stripe
 * transfer, when needed, happens upstream in the stripeConnect action; here we
 * only freeze the status and the audit trail.
 */
export const cancelReferral = internalMutation({
  args: {
    referralId: v.id("referrals"),
    reason: v.string(),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.referralId, {
      status: "cancelled" as const,
      cancelledAt: Date.now(),
      statusReason: args.reason,
      ...(args.adminNote ? { adminNote: args.adminNote } : {}),
    });
  },
});

/* ── Public queries ── */

export const getMyReferrals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return [];

    return await ctx.db
      .query("referrals")
      .withIndex("by_referrerId", (q) => q.eq("referrerId", affiliate._id))
      .order("desc")
      .take(50);
  },
});

export const getMyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return null;

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrerId", (q) => q.eq("referrerId", affiliate._id))
      .take(200);

    const totalReferrals = referrals.length;
    const pendingCount = referrals.filter(
      (r) => r.status === "pending",
    ).length;
    /* `paying` counts with the commissions still owed, not with the paid ones:
       the transfer is claimed but unconfirmed, and a failed run puts the row
       back to `payable`. Leaving it out of both sets — which is what happens if
       these filters are not told about it — makes an affiliate's earnings
       silently drop by one commission for as long as a payout is in flight. */
    const validatedCount = referrals.filter(
      (r) =>
        r.status === "validated" ||
        r.status === "payable" ||
        r.status === "paying" ||
        r.status === "paid",
    ).length;
    const paidCount = referrals.filter((r) => r.status === "paid").length;
    const totalEarned = referrals
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.commissionCents, 0);
    const totalPending = referrals
      .filter(
        (r) =>
          r.status === "pending" ||
          r.status === "validated" ||
          r.status === "payable" ||
          r.status === "paying",
      )
      .reduce((sum, r) => sum + r.commissionCents, 0);

    return {
      totalReferrals,
      pendingCount,
      validatedCount,
      paidCount,
      totalEarned,
      totalPending,
    };
  },
});

/* ── Affiliate invoicing (invoice mandatory before payout, art. 4.2) ── */

/**
 * Signed upload URL for attaching an invoice (the file is POSTed to it).
 *
 * This is the first half of `attachReferralInvoice` below, and it used to ask
 * for strictly less than the half that follows it: any signed-in account, with
 * or without an affiliate profile, could mint upload URLs without limit, and
 * nothing ever collected the files that were never attached. It now asks for
 * the same profile its sibling does and spends a quota to do it. Files that are
 * minted and never attached are swept by ./storageSweep.ts.
 */
export const generateInvoiceUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    // The profile, and deliberately nothing more. `attachReferralInvoice` below
    // — the other half of this same flow — asks for a profile, ownership of the
    // commission and a commission that is not yet `paid`/`cancelled`, and says
    // nothing about `affiliate.status`. Gating the mint on `status` and not the
    // attach would leave a suspended apporteur able to attach an invoice but
    // unable to produce the URL to upload one, and art. 4.2 makes that invoice
    // mandatory before payout — so the stricter gate would withhold a payout,
    // not prevent an abuse. Whether a suspended apporteur may still invoice a
    // commission earned before suspension is a business question, and it is not
    // answered here.
    //
    // Two windows, as everywhere else here. The per-affiliate one is keyed on
    // the id the server resolved, not on anything the caller sent. The
    // site-wide one is the bound an attacker who signs up repeatedly — the
    // affiliate profile is self-serve — cannot dodge.
    await consumeRateLimit(ctx, "invoiceUploadUrlPerAffiliate", affiliate._id);
    await consumeRateLimit(ctx, "invoiceUploadUrlSiteWide", SITE_SUBJECT);

    return await ctx.storage.generateUploadUrl();
  },
});

/** Attaches the uploaded invoice to a commission of the signed-in affiliate. */
export const attachReferralInvoice = mutation({
  args: {
    referralId: v.id("referrals"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    const referral = await ctx.db.get(args.referralId);
    if (!referral || referral.referrerId !== affiliate._id) {
      throw new Error("Commission introuvable");
    }
    /* `paying` refuses too: the invoice is a precondition of the payout
       (`markValidatedAsPayable`), so by then one exists and a transfer is
       already in flight against it. Swapping it underneath would leave the
       money moved on the strength of a document nobody kept. */
    if (
      referral.status === "paid" ||
      referral.status === "paying" ||
      referral.status === "cancelled"
    ) {
      throw new Error("Cette commission n'accepte plus de facture");
    }

    await ctx.db.patch(args.referralId, {
      invoiceStorageId: args.storageId,
      invoiceUploadedAt: Date.now(),
    });
  },
});

/** Read URL for the invoice — available to its owner or to an admin. */
export const getReferralInvoiceUrl = query({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return null;

    const referral = await ctx.db.get(args.referralId);
    if (!referral || !referral.invoiceStorageId) return null;
    if (referral.referrerId !== affiliate._id && affiliate.role !== "admin") {
      return null;
    }

    return await ctx.storage.getUrl(referral.invoiceStorageId);
  },
});
