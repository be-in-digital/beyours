import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Validate pending referrals daily at 3am UTC
crons.cron(
  "validate pending referrals",
  "0 3 * * *",
  internal.referrals.validatePendingReferrals,
  {},
);

// Mark validated referrals as payable (when affiliate has active Stripe Connect)
crons.cron(
  "mark validated as payable",
  "30 3 * * *",
  internal.referrals.markValidatedAsPayable,
  {},
);

// Process payouts for payable referrals (Stripe Connect transfers)
crons.cron(
  "process payouts",
  "0 10 * * 1,4",
  internal.stripeConnect.processPayouts,
  {},
);

export default crons;
