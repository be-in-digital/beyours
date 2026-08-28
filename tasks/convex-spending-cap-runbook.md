# Runbook — Convex spending cap & account recovery (team `momoseck8`)

> Closes the engineering half of **LAUNCH-07**. The other half is a dashboard
> action only the team owner can perform — this file tells them exactly what to
> click, and why it matters. It contains **no credential**.

## Why this card exists

Production stays on team `momoseck8` — decided 2026-08-16, recorded in
`production-accounts-checklist.md` §0. Two consequences do not go away by
themselves:

1. **Convex spending caps apply per team, not per project.** One threshold
   crossed takes down *every* project on the team, production included.
2. **Account recovery runs through that team's owner**, who is not
   `developers@beyours.fr`. If that person is unreachable, so is the backend.

---

## 1. What actually happens — it depends on the plan

This is the part the card's one-line summary gets wrong. "A cap set too low"
is only a risk on a **paid** plan. On Free there is no cap to set, and the
failure mode is different. Establish the plan first; everything below branches
on it.

| Plan | Is there a spending-limit setting? | What happens at the ceiling |
|---|---|---|
| **Free** | **No.** Hard resource caps, nothing to configure. | Warning emails as you approach a limit. Exceed it *for an extended period* and "your deployment may return HTTP errors in response to function calls." |
| **Starter** | Pay-as-you-go past the included amounts. | Warning emails, then metered charges at the published rate. No automatic shutdown. |
| **Professional / Business / Enterprise** | **Yes** — warning + disable thresholds, on the billing page. | See below. |

On a paid plan there are two distinct thresholds, and only one of them is
dangerous:

- **Warning threshold — soft.** Exceeded, the team is emailed. Nothing else
  happens.
- **Disable threshold — hard.** Exceeded, **all projects in the team are
  disabled**, and functions throw when called. Recovery is to raise or remove
  the limit.

Two details that decide what number is safe:

- Spending limits count **only usage beyond what the plan includes**. Seat fees
  are excluded from the total.
- Consequently, a limit of **$0/month is not "no spending" — it is a live
  tripwire.** You are billed seat fees only, and the moment the team's built-in
  resources are exhausted every project is disabled.

Sources: [Teams — Spending Limits](https://docs.convex.dev/dashboard/teams/teams),
[Pricing FAQ](https://www.convex.dev/pricing/faq), [Pricing](https://www.convex.dev/pricing).
Checked 2026-08-28.

---

## 2. Blast radius — what goes down together

Every Convex deployment on team `momoseck8` shares one bill and one disable
threshold. Measured from outside on **2026-08-28**, unauthenticated
`GET /version`:

| Deployment | Role, per the repo | `/version` | Source of the role claim |
|---|---|---|---|
| `fearless-poodle-133` | **prod** — `apps/site` (beyours.fr) | `200` live | `apps/site/.env.production.example:25`, `check-prod-bundle.mjs:26` |
| `reliable-parrot-452` | **dev** — engine (`apps/reference`) | `200` live | `apps/reference/MISE_EN_PROD.md:14` |
| `robust-elephant-263` | claimed **prod** — Stripe BID billing | `200` live | `tasks/production-checklist.md:7` |
| `happy-otter-123` | **dead** — caused bug #6 | `404` | `check-prod-bundle.mjs:30` |

Two things this measurement settles, and one it does not:

- `robust-elephant-263` **exists and answers.** `clickup-technique-cards.md:344`
  records it as appearing nowhere outside one checklist and therefore
  unverifiable. It is real.
- `happy-otter-123` is confirmed gone — the blocklist in `check-prod-bundle.mjs`
  is still earning its place.
- **Team membership cannot be read from outside.** That these three deployments
  are all on `momoseck8` is what the repo claims, not something `/version`
  proves. Confirm it in the dashboard while you are there (step 3 below) — it is
  the whole blast radius, so it is worth being certain about.

> The deployment inventory is contradictory elsewhere in the repo — three
> documents disagree about which deployment is production, and about the project
> name. That is card 15's job, not this one. Do not resolve it here.

---

## 3. The check

Dashboard, as the owner of team `momoseck8`. Roughly ten minutes.

1. **Read the plan.** <https://dashboard.convex.dev/team/settings/billing> →
   note which tier the team is on. This selects which row of §1 applies.

2. **If the plan is paid — read both thresholds.** Record the warning and
   disable values. A disable threshold of `$0` or a tight round number is the
   failure this card is about. Prefer a **warning threshold you will actually
   read** over a disable threshold that silences the product: an email is
   recoverable, a disabled production backend is a customer-facing outage.

3. **Confirm the blast radius.** On the same team, list its projects and
   confirm the three live deployments in §2 belong to it. Anything else on that
   team shares the threshold too — write it down.

4. **If the plan is Free** — there is no cap to set. Check current usage
   against the included amounts instead (1M function calls, 0.5 GB database,
   1 GB file storage, 20 GB-hours action compute, 1 GB database I/O, 1 GB
   egress) and confirm the warning emails reach a mailbox somebody reads.

5. **Confirm the billing method is current.** A cap that is high enough does not
   help if the card behind it has expired.

---

## 4. Account recovery — the second half of the card

Access to production depends on one personal account. Fix the bus factor:

1. <https://dashboard.convex.dev/team/settings/members> → confirm **at least
   two people hold the Admin role** on team `momoseck8`.

   **It has to be Admin, and the distinction is the whole point.** Convex has two
   team roles. A *Developer* can read usage and billing status — they will see
   the invoice climbing — but **only an Admin can manage the subscription and
   billing details**, which is what raising the disable threshold requires. So a
   second Developer buys you early warning and nothing else: during an outage
   they can watch it and not end it. The team's creator is Admin automatically;
   if they are the only one, the product cannot be recovered without them.
2. Add `developers@beyours.fr` as the second admin, once that mailbox exists
   (it is a prerequisite in `production-accounts-checklist.md` and is not
   assumed done here).
3. Record in the password manager — never in this repo — which account owns the
   team, which mailbox receives the billing and threshold emails, and where the
   recovery codes live.

---

## 5. Is production down right now?

Verified one-liner. Live deployments answer `200` with a build stamp; deleted or
misspelled ones answer `404`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://fearless-poodle-133.convex.cloud/version
```

**Read the result carefully — this check is asymmetric:**

- **`404` is a definite red.** The deployment is gone, renamed, or the URL is
  wrong.
- **`200` is not a green for billing.** `/version` is served by the backend
  itself, not by a Convex function, and the documented symptom of a tripped
  disable threshold is *functions throwing* — which a `/version` probe would
  never see. A funded team and a disabled one can both answer `200`.

So: use it to rule a deployment *out*, never to sign this card *off*. The only
authority on the cap is the billing page.

If you need a true end-to-end signal, call a real public query and assert it
succeeds — but note that no such probe is wired up today, and the negative case
has never been observed against a genuinely disabled team. Do not build one on
the assumption that it works; verify it against a deployment you have
deliberately disabled first.

---

## 6. What this repo can and cannot detect

Stated plainly, because a check that looks like coverage and is not is worse
than no check at all.

| | Detected today? |
|---|---|
| Prod bundle wired to the wrong Convex deployment | **Yes** — `apps/site/scripts/check-prod-bundle.mjs`, run by hand |
| A deployment deleted or renamed | Only if somebody runs the `curl` in §5 |
| **Team disabled by the spending cap** | **No.** Nothing in this repo notices. |
| Billing method expired | **No.** |

There is no automated guard for the cap, and this runbook does not add one —
adding a probe whose failure case has never been observed would manufacture
confidence rather than coverage. Until one exists and is proven against a
disabled deployment, **the recurring calendar reminder in §7 is the control.**

---

## 7. Sign-off

- [ ] Plan tier for team `momoseck8` recorded
- [ ] Paid plan: warning + disable thresholds recorded, disable threshold not `$0`
- [ ] Free plan: usage checked against included amounts; warning emails reach a monitored mailbox
- [ ] The team's project list confirmed, and the blast radius written down
- [ ] Billing method current
- [ ] **Two** holders of the **Admin** role (not Developer — a Developer cannot raise the limit), one reachable independently of the owner
- [ ] Owner account, billing mailbox and recovery codes recorded in the password manager
- [ ] A recurring reminder exists to redo §3 — this is the only control until a proven probe exists

---

*Related: `production-accounts-checklist.md` §0 (the no-transfer decision),
`apps/reference/MISE_EN_PROD.md` §1, `tasks/clickup-technique-cards.md` card 15
(the deployment inventory, still open).*
