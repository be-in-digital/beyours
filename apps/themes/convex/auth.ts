import { components } from "./_generated/api";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

// Better Auth component client
//
// The type annotation is not decoration. `createClient`'s return type mentions
// `GenericCtx<DataModel>` a dozen times over, so the inferred type here grows
// with the schema — and the catalogue translation columns pushed it past what
// TypeScript will serialise (TS7056). Naming the type keeps the compiler from
// having to write it out.
export const authComponent: ReturnType<typeof createClient<DataModel>> =
  createClient<DataModel>(components.betterAuth);

/**
 * Origins allowed to make credentialed requests against this deployment.
 *
 * Exported so `client-site-trusted-origins.test.ts` can execute it rather than
 * grep for it: the defect this replaces was visible in the source for anyone
 * who read three lines past a comment forbidding it, and no test read either.
 */
export function buildTrustedOrigins(siteUrl: string | undefined): string[] {
  const origins = siteUrl ? [siteUrl] : [];
  // Unset is a development machine or a broken deployment, never a delivered
  // site: `SITE_URL` is required and the app refuses to start without it.
  const isLocal = !siteUrl || /^https?:\/\/localhost(:\d+)?\/?$/i.test(siteUrl);
  if (isLocal) origins.push("http://localhost:3000");
  return [...new Set(origins)];
}

/**
 * Post one transactional email to the deployment's own `/api/email/send`.
 *
 * Convex holds no SES credentials — the Next app does — so every mail Better
 * Auth wants to send crosses this seam. Two failures used to be possible here
 * and BOTH were silent: a deployment missing `SITE_URL` or the shared secret
 * returned early without a word, and a 4xx from the route was never read, so a
 * refused link looked exactly like a delivered one. A restaurateur waiting on
 * an email they will never receive had nothing to look at, and neither did we.
 *
 * It throws now. On a misconfigured deployment that turns an invisible dead end
 * into a visible error, which is the only version of this an operator can act
 * on.
 */
async function sendTransactionalEmail(body: {
  type: string;
  to: string;
  data: Record<string, string>;
}): Promise<void> {
  const siteUrl = process.env.SITE_URL;
  // Must match what app/api/email/send/route.ts authenticates with:
  // EMAIL_API_SECRET when set, BETTER_AUTH_SECRET while migrating.
  const secret =
    process.env.EMAIL_API_SECRET ?? process.env.BETTER_AUTH_SECRET;

  if (!siteUrl || !secret) {
    const missing = [
      !siteUrl ? "SITE_URL" : null,
      !secret ? "EMAIL_API_SECRET (or BETTER_AUTH_SECRET)" : null,
    ]
      .filter(Boolean)
      .join(" and ");
    console.error(
      `[auth] Cannot send "${body.type}": ${missing} is not set on the Convex deployment. ` +
        "Set it with `npx convex env set`."
    );
    throw new Error(`Email delivery is not configured (${missing}).`);
  }

  const res = await fetch(`${siteUrl}/api/email/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // The body carries the route's own reason — a link outside SITE_URL, a
    // secret the two halves disagree on — and it is the only place that reason
    // exists.
    const detail = await res.text().catch(() => "");
    console.error(
      `[auth] "${body.type}" to ${body.to} was refused with ${res.status}: ${detail.slice(0, 300)}`
    );
    throw new Error(`Email delivery failed (${res.status}).`);
  }
}

// Better Auth server configuration
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      // Verification stays REQUIRED unless a deployment explicitly opts out.
      //
      // The e2e suite signs in as a seeded account, and `seed-users.mts` has no
      // mailbox to click a link in — so with verification always on, the suite
      // could never have authenticated at all. That is one of the reasons its
      // 510 tests had never run.
      //
      // Fail-closed on purpose: the flag must be SET to "true" to relax
      // anything, so an unset or mistyped variable keeps verification on. Set
      // it on a test deployment only — never on one a restaurant is served
      // from.
      requireEmailVerification:
        process.env.AUTH_ALLOW_UNVERIFIED_EMAIL !== "true",
      minPasswordLength: 12,
      // A reset must end every session the old password could still be
      // holding open. Without this a stolen session survives the reset that
      // was performed to kill it — for up to seven days, the session lifetime.
      // The in-app password change already passed `revokeOtherSessions: true`;
      // the reset path, the one used precisely when an account is believed
      // compromised, did not.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendTransactionalEmail({
          type: "passwordReset",
          to: user.email,
          data: {
            resetLink: url,
            expirationTime: "1 hour",
            userName: user.name ?? user.email,
          },
        });
      },
    },
    /**
     * The half that was missing.
     *
     * `requireEmailVerification` is on by default (see above), and Better Auth
     * only mints a verification token when a sender exists: `sign-up.mjs:241`
     * creates the token, finds no `sendVerificationEmail`, sends nothing and
     * skips auto-sign-in; `sign-in.mjs:231` then answers every later attempt
     * with `EMAIL_NOT_VERIFIED`. Sign-up reported success and left the account
     * permanently unreachable.
     *
     * `sendOnSignIn` matters as much as `sendOnSignUp`: it is the way back for
     * anyone who signed up before this existed, or who lost the mail. It only
     * fires after the password has been checked, so it is not a way to make
     * this deployment mail a stranger.
     */
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendTransactionalEmail({
          type: "verifyEmail",
          to: user.email,
          data: {
            verifyLink: url,
            userName: user.name ?? user.email,
          },
        });
      },
    },
    // DIVERGENCE DÉLIBÉRÉE vis-à-vis d'apps/reference — ne pas aligner.
    // Le banc d'essai fait confiance à localhost:3000-3003 parce que ses
    // espaces de travail se disputent les ports. Un site client n'a aucune
    // raison d'accepter une origine de développement : il tourne sur son
    // domaine. Élargir cette liste ici, c'est l'élargir chez le restaurateur.
    //
    // The comment above said exactly that, and the code three lines below it
    // trusted `http://localhost:3000` UNCONDITIONALLY — in both branches, on
    // every delivered client site. A credentialed origin is permission for a
    // page on that origin to make authenticated requests with the visitor's
    // session, so any process able to serve on a restaurant customer's own
    // port 3000 could act as them against the restaurant's backend.
    //
    // The fix takes the signal already required rather than adding one:
    // `SITE_URL` is in `siteRequiredShape`, a deployment does not boot without
    // it, and it is `http://localhost:3000` on a developer's machine and the
    // real domain on a client's. So localhost is trusted exactly while the
    // site IS localhost, and a delivered site stops trusting it the moment its
    // domain is configured — no new variable to set, and nothing to remember
    // at deploy time, which is what made the old shape survive review.
    trustedOrigins: buildTrustedOrigins(process.env.SITE_URL),
    plugins: [convex({ authConfig })],
  });
};

// Client API for AuthBoundary component
export const { getAuthUser } = authComponent.clientApi();

// @kept-callerless: no screen calls this — the apps read the session through
// `authClient.useSession()`. `tasks/convex-account-cutover-runbook.md:39` uses
// `auth:getCurrentUser` as the smoke test that a cut-over deployment answers at
// all, which is the first check run against a fresh Convex account (#413).
// @guarded-inline: returns the caller's own session user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.safeGetAuthUser(ctx);
  },
});
