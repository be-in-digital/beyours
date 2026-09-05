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

// Enforce the published retention schedule: prospects are deleted three years
// after their last contact (/confidentialite §6). Off-peak, and next to the
// storage sweep, so the two destructive jobs land together in the log. Neither
// reads what the other writes — no row this one deletes references a file.
crons.cron(
  "delete expired prospects",
  "15 4 * * *",
  internal.retention.sweepExpiredProspects,
  {},
);

// Delete upload-URL files that were never attached to a commission.
// Off-peak, and after the referral jobs above have settled the rows this reads.
crons.cron(
  "sweep orphaned uploads",
  "45 4 * * *",
  internal.storageSweep.sweepOrphanUploads,
  {},
);

export default crons;
