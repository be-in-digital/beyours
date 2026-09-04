import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled work for a restaurant deployment.
 *
 * A scheduled job runs with NO user identity, so everything referenced here
 * must be `internal.*`. Reaching for `api.*` calls a function that will either
 * refuse the sweep — if it is guarded — or is public and should not be; the
 * nightly menu push already died that way once. `tests/convex/scheduled-paths`
 * asserts the rule against the source.
 */
const crons = cronJobs();

// Expire invitations past their seven days, clear their tokens, and delete the
// ones nobody ever accepted after thirty more. 4am UTC: outside service, and
// away from the 3am hour the commercial site already uses.
crons.cron(
  "sweep stale invitations",
  "0 4 * * *",
  internal.teamMembers.sweepInvitations,
  {},
);

// Start the campaigns whose scheduled time has arrived. `schedule` wrote a
// status and a date, the wizard offered a picker, and nothing ever read either:
// a scheduled campaign sat at `scheduled` for good and the only way to send was
// the manual menu item. Every minute, because a campaign timed for 18:00 that
// goes out at 18:05 is a different promise than the owner made.
crons.interval(
  "dispatch scheduled campaigns",
  { minutes: 1 },
  internal.emailCampaigns.dispatchScheduled,
  {},
);

// Start the win-back for customers who have gone quiet. Daily at 9am UTC: a
// "you have not been in a while" landing at 4am reads as a machine, and the
// sweep is cheap — it only walks stores that actually have such an automation.
crons.cron(
  "win back lapsed customers",
  "0 9 * * *",
  internal.emailAutomationActions.sweepInactive,
  {},
);

// Delete kitchen tickets finished more than 30 days ago. The KDS reads are
// bounded now, but a bound on the read only moves the problem: the table still
// grows without limit and the completed history becomes unreadable. 2:30am UTC
// — clear of the invitation sweep at 4am, and outside service everywhere.
// The job reschedules itself a minute later while there is more to delete.
crons.cron(
  "purge expired kitchen tickets",
  "30 2 * * *",
  internal.kitchenTickets.purgeExpiredTickets,
  {},
);

// Queue the articles an Auto Blog subscription is due. Hourly, because
// `preferredHour` is an hour: the planner asks each configuration whether this
// is its hour in its own timezone, and writes a queue row if it is. It calls
// no paid API — a sweep that finds nothing costs one indexed read.
crons.cron(
  "plan auto blog jobs",
  "0 * * * *",
  internal.blogAutoPlanner.planAutoBlogJobs,
  {},
);

// Generate what the planner queued. Every 10 minutes rather than hourly: an
// article scheduled for 09:00 that appears at 09:55 is not the promise the
// owner configured, and a generation that fails still has its retries inside
// the hour. The spec asks for 5-15 minutes (tasks/auto-blog-spec.md §4.2).
crons.interval(
  "execute auto blog queue",
  { minutes: 10 },
  internal.blogAutoGenerate.executeAutoBlogQueue,
  {},
);

export default crons;
