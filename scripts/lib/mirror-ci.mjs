/**
 * What the mirror's own CI conclusion means for us.
 *
 * WHY THIS EXISTS. `mirror-health.yml` asks two questions — did the last sync
 * finish, and is the mirror current — and neither of them is "does the mirror
 * pass its own tests". Measured on 15 September 2026: the boilerplate's CI had
 * failed four runs in a row while `Publish mirror` succeeded here, so the
 * observer job was skipped (it fires only on a non-success conclusion of OUR
 * run) and the staleness job had nothing to report (the mirror was current —
 * current AND red). Nobody was told.
 *
 * The three states this distinguishes, and why they are three:
 *
 *   `red`      — the mirror's latest run on its default branch did not succeed.
 *                Every client repository is cloned from that tree. Report it.
 *   `green`    — it succeeded. Say nothing.
 *   `unknown`  — we could not ask: no token, a token without `actions: read`,
 *                a repository with no runs yet. NOT a pass and NOT a failure.
 *                An `unknown` reported as red is a daily false alarm; reported
 *                as green is the silence this whole file exists to end.
 *
 * Pure, and given the API's answer rather than fetching it, so the decision can
 * be tested without a network or a token — which is the half that actually goes
 * wrong.
 */

/** Conclusions that mean the run neither passed nor is still deciding. */
const FAILED_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "startup_failure",
  "action_required",
])

/**
 * Read `GET /repos/{owner}/{repo}/actions/runs`'s answer.
 *
 * `payload` is the parsed body, or `null` when the call itself failed.
 */
export function classifyMirrorCi(payload) {
  if (payload === null || payload === undefined) {
    return { state: "unknown", reason: "the mirror's runs could not be read" }
  }

  const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : null
  if (runs === null) {
    return { state: "unknown", reason: "the answer carried no workflow_runs" }
  }
  if (runs.length === 0) {
    return { state: "unknown", reason: "the mirror has no workflow run on that branch" }
  }

  const [latest] = runs

  // A run still going is not a verdict. Saying "red" here would open an issue
  // every morning the sync happened to be mid-flight.
  if (latest.status !== "completed") {
    return {
      state: "unknown",
      reason: `the latest run is ${String(latest.status)}, not completed`,
      run: latest,
    }
  }

  if (latest.conclusion === "success") {
    return { state: "green", run: latest }
  }

  // `skipped` and `neutral` are deliberately neither: a workflow that decided
  // not to run says nothing about the tree. Treating them as red is how a
  // health check trains its readers to ignore it.
  if (!FAILED_CONCLUSIONS.has(String(latest.conclusion))) {
    return {
      state: "unknown",
      reason: `the latest run concluded ${String(latest.conclusion)}`,
      run: latest,
    }
  }

  return { state: "red", run: latest }
}

/**
 * The jobs worth naming in the report: the ones that did not pass.
 *
 * A run's own name says nothing about what broke, and "the mirror's CI is red"
 * with no job names is a message whose only possible response is to go and look
 * — which is the work the report was supposed to save.
 */
export function failedJobNames(payload) {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : []
  return jobs
    .filter(
      (job) =>
        job.status === "completed" && FAILED_CONCLUSIONS.has(String(job.conclusion))
    )
    .map((job) => String(job.name))
}

export { FAILED_CONCLUSIONS }
