"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { resolveStripeAccess } from "./stripeMode";

/**
 * Stripe when a key is configured, `null` when there is none.
 *
 * For the two reads below that legitimately degrade without Stripe. Anything
 * that moves money or writes a Stripe-derived state uses
 * `getStripeOrTestMode` instead, which refuses an unconfigured deployment.
 */
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/**
 * Stripe for a path that moves money, or `null` on the deliberate test path.
 * See ./stripeMode.
 */
function getStripeOrTestMode(operation: string): Stripe | null {
  const access = resolveStripeAccess(operation);
  return access.mode === "test" ? null : new Stripe(access.secretKey);
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

    /* This branch writes `active` and a fabricated `acct_test_…` onto a real
       affiliate. Without a key that state was indistinguishable from a
       completed onboarding, and payouts read it. */
    const stripe = getStripeOrTestMode("connecter un compte Stripe apporteur");

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

      // Accounts v2. Stripe refuses `accounts.create` (v1) on Connect
      // integrations set up from 2025 onward, so this is not a preference.
      //
      // `dashboard: "express"` is what replaces v1's `type: "express"`, and it
      // *requires* both responsibilities to be "application" — Stripe rejects
      // the pair otherwise. The transfers capability moved from
      // `capabilities.transfers` to
      // `configuration.recipient.capabilities.stripe_balance.stripe_transfers`,
      // which is the one that lets `transfers.create` reach this account.
      //
      // `include` is not optional in practice: without it Stripe returns null
      // for `configuration`, `identity` and `requirements` whatever their real
      // values, so the status read below would see nothing.
      let account;
      try {
        account = await stripe.v2.core.accounts.create({
          contact_email: email ?? undefined,
          display_name:
            [affiliate.firstName, affiliate.lastName].filter(Boolean).join(" ") ||
            undefined,
          dashboard: "express",
          identity: {
            country: "fr",
            entity_type: "individual",
            // v2 renames these: first_name → given_name, last_name → surname.
            individual: {
              ...(affiliate.firstName ? { given_name: affiliate.firstName } : {}),
              ...(affiliate.lastName ? { surname: affiliate.lastName } : {}),
              ...(email ? { email } : {}),
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: { stripe_transfers: { requested: true } },
              },
            },
          },
          defaults: {
            currency: "eur",
            locales: ["fr-FR"],
            responsibilities: {
              fees_collector: "application",
              losses_collector: "application",
            },
          },
          metadata: {
            affiliateUserId: String(affiliate._id),
          },
          include: ["configuration.recipient", "identity", "requirements"],
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

    // v2 account links are a different resource from `stripe.accountLinks`, and
    // the URLs moved inside `use_case.account_onboarding`. `configurations`
    // names which part of the account is being onboarded — "recipient", since
    // affiliates only ever receive transfers.
    const accountLink = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: args.refreshUrl,
          return_url: args.returnUrl,
        },
      },
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

    /* A read, and the one place `getStripe` is still right: with no key it
       reports the stored status rather than refusing. Nothing is written. */
    const stripe = getStripe();
    if (!stripe) {
      return {
        status: affiliate.stripeConnectStatus,
        payoutsEnabled: affiliate.stripeConnectStatus === "active",
      };
    }

    // Deliberately the v1 endpoint, on a v2 account. Stripe returns v2 data in
    // the v1 object shape, and it was checked against a real v2 account:
    // `payouts_enabled`, `details_submitted` and `capabilities.transfers` all
    // come back populated. Two reasons to keep it rather than read
    // `configuration.recipient.capabilities.stripe_balance.stripe_transfers`:
    // the `account.updated` webhook in http.ts receives this same v1 shape, so
    // one rule derives the status in both places instead of two that can drift;
    // and the same call carries `individual`, used for the profile sync below.
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
    const stripe = getStripeOrTestMode("verser les commissions dues");
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
      /* `getStripe` again: the no-key path here already writes an explicit
         "recover manually" note rather than pretending the reversal happened. */
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
