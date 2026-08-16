"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/* ── Onboarding: create an Express account + Account Link ── */

export const createAccountLink = action({
  args: {
    returnUrl: v.string(),
    refreshUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string | null; testMode: boolean }> => {
    const affiliate = await ctx.runQuery(
      internal.affiliateUsers.getMeInternal,
      {},
    );
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    const stripe = getStripe();

    // Test mode: fake an active Stripe Connect account
    if (!stripe) {
      await ctx.runMutation(
        internal.affiliateUsers.updateStripeConnectStatus,
        {
          affiliateUserId: affiliate._id,
          stripeConnectStatus: "active",
          stripeConnectAccountId: "acct_test_" + Date.now(),
        },
      );
      return { url: null, testMode: true };
    }

    let accountId = affiliate.stripeConnectAccountId;

    if (!accountId) {
      const email: string | null = await ctx.runQuery(
        internal.affiliateUsers.getEmailById,
        { affiliateUserId: affiliate._id },
      );

      let account;
      try {
        account = await stripe.accounts.create({
          type: "express",
          country: "FR",
          email: email ?? undefined,
          capabilities: {
            transfers: { requested: true },
          },
          business_type: "individual",
          individual: {
            ...(affiliate.firstName ? { first_name: affiliate.firstName } : {}),
            ...(affiliate.lastName ? { last_name: affiliate.lastName } : {}),
            ...(email ? { email } : {}),
          },
          business_profile: {
            url: "https://beindigital.fr",
          },
          metadata: {
            affiliateUserId: String(affiliate._id),
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("signed up for Connect")) {
          throw new Error(
            "STRIPE_CONNECT_NOT_ENABLED"
          );
        }
        throw err;
      }

      accountId = account.id;

      await ctx.runMutation(
        internal.affiliateUsers.updateStripeConnectStatus,
        {
          affiliateUserId: affiliate._id,
          stripeConnectStatus: "pending",
          stripeConnectAccountId: accountId,
        },
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: args.returnUrl,
      refresh_url: args.refreshUrl,
    });

    return { url: accountLink.url, testMode: false };
  },
});

/* ── Check the status of a Connect account ── */

export const checkAccountStatus = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ status: string; payoutsEnabled: boolean }> => {
    const affiliate = await ctx.runQuery(
      internal.affiliateUsers.getMeInternal,
      {},
    );
    if (!affiliate?.stripeConnectAccountId) {
      return { status: "not_started", payoutsEnabled: false };
    }

    const stripe = getStripe();
    if (!stripe) {
      return {
        status: affiliate.stripeConnectStatus,
        payoutsEnabled: affiliate.stripeConnectStatus === "active",
      };
    }

    const account = await stripe.accounts.retrieve(
      affiliate.stripeConnectAccountId,
    );

    const isActive =
      account.payouts_enabled === true &&
      account.capabilities?.transfers === "active";

    const newStatus = isActive
      ? "active"
      : account.details_submitted
        ? "pending"
        : "not_started";

    if (newStatus !== affiliate.stripeConnectStatus) {
      await ctx.runMutation(
        internal.affiliateUsers.updateStripeConnectStatus,
        {
          affiliateUserId: affiliate._id,
          stripeConnectStatus: newStatus as
            | "not_started"
            | "pending"
            | "active"
            | "disabled",
        },
      );
    }

    // Sync individual info from Stripe → profile (if profile is incomplete)
    const individual = account.individual;
    if (individual) {
      const needsSync =
        (!affiliate.firstName && individual.first_name) ||
        (!affiliate.lastName && individual.last_name) ||
        (!affiliate.phone && individual.phone);

      if (needsSync) {
        await ctx.runMutation(
          internal.affiliateUsers.syncFromStripe,
          {
            affiliateUserId: affiliate._id,
            firstName: individual.first_name ?? undefined,
            lastName: individual.last_name ?? undefined,
            phone: individual.phone ?? undefined,
          },
        );
      }
    }

    return { status: newStatus, payoutsEnabled: isActive };
  },
});

/* ── Payout processing (payable → paid) ── */

export const processPayouts = internalAction({
  args: {},
  handler: async (ctx) => {
    const stripe = getStripe();
    if (!stripe) {
      console.log("[TEST MODE] Skipping payout processing");
      return;
    }

    const payableReferrals = await ctx.runQuery(
      internal.referrals.getPayableReferrals,
      {},
    );

    let processed = 0;
    for (const referral of payableReferrals) {
      const affiliate = await ctx.runQuery(internal.affiliateUsers.getById, {
        affiliateUserId: referral.referrerId,
      });

      if (
        !affiliate?.stripeConnectAccountId ||
        affiliate.stripeConnectStatus !== "active"
      ) {
        continue;
      }

      try {
        const transfer = await stripe.transfers.create({
          amount: referral.commissionCents,
          currency: "eur",
          destination: affiliate.stripeConnectAccountId,
          description: `Commission parrainage - Commande ${referral.orderId}`,
          metadata: {
            referralId: String(referral._id),
            orderId: String(referral.orderId),
            affiliateUserId: String(referral.referrerId),
          },
        });

        await ctx.runMutation(internal.referrals.markPaid, {
          referralId: referral._id,
          stripeTransferId: transfer.id,
        });

        // Let the affiliate know their commission has been paid (best-effort)
        const affiliateEmail = await ctx.runQuery(
          internal.affiliateUsers.getEmailById,
          { affiliateUserId: referral.referrerId },
        );
        if (affiliateEmail) {
          await ctx.scheduler.runAfter(
            0,
            internal.email.send.sendAffiliateCommission,
            {
              toEmail: affiliateEmail,
              amountCents: referral.commissionCents,
              paid: true,
            },
          );
        }

        processed++;
        console.log(
          `Payout ${transfer.id} created for referral ${referral._id} (${referral.commissionCents} cents)`,
        );
      } catch (err) {
        console.error(`Payout failed for referral ${referral._id}:`, err);
      }
    }

    if (processed > 0) {
      console.log(`Processed ${processed} payouts`);
    }
  },
});

/* ── Clawback: reverse / cancel a commission ──
   Called by the Stripe webhook (refund, chargeback). When the commission has
   already been paid out we reverse the transfer (transfers.createReversal);
   otherwise we simply cancel it. Enforces art. 4.3 of the affiliate contract. */

export const reverseReferralCommission = internalAction({
  args: {
    referralId: v.id("referrals"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const referral = await ctx.runQuery(internal.referrals.getByIdInternal, {
      referralId: args.referralId,
    });
    if (!referral || referral.status === "cancelled") return;

    // Already paid out: try to pull the funds back from the connected account.
    if (referral.status === "paid" && referral.stripeTransferId) {
      const stripe = getStripe();
      let adminNote = "Commission reprise avant traitement.";
      if (stripe) {
        try {
          const reversal = await stripe.transfers.createReversal(
            referral.stripeTransferId,
            {
              description: args.reason,
              metadata: { referralId: String(referral._id) },
            },
          );
          adminNote = `Commission reprise (reversal ${reversal.id}).`;
          console.log(
            `Reversed transfer ${referral.stripeTransferId} for referral ${referral._id}`,
          );
        } catch (err) {
          adminNote =
            "Reprise Stripe échouée (solde du compte connecté insuffisant ?) — à récupérer manuellement.";
          console.error(`Reversal failed for referral ${referral._id}:`, err);
        }
      }
      await ctx.runMutation(internal.referrals.cancelReferral, {
        referralId: referral._id,
        reason: args.reason,
        adminNote,
      });
      return;
    }

    // Not paid out yet: a plain cancellation, nothing to reverse.
    await ctx.runMutation(internal.referrals.cancelReferral, {
      referralId: referral._id,
      reason: args.reason,
    });
  },
});
