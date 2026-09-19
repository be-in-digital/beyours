/**
 * Uber Eats production validation runner.
 *
 * Hits every endpoint Uber requires for production access against the
 * sandbox test client (BN3BbPRSpD7-...) and the test store provided by
 * Uber (480eab8c-cc25-4c2b-b92f-70d7a1984f97). Prints method, path, and
 * status for each call so the output can be screenshotted and sent to
 * Uber.
 *
 * Run from the repo root (Node 20+ for --env-file):
 *   node --env-file=.env --import tsx scripts/uber-eats-validation.ts
 *
 * Prefer the equivalent Convex action for production-like execution:
 *   apps/reference/convex/uberEatsActions.ts → runValidation
 */

import { uberEats } from "@be-yours/integrations"
import { isSandbox } from "@be-yours/core/env"

const TEST_STORE_UUID = "480eab8c-cc25-4c2b-b92f-70d7a1984f97"

const credentials = {
  clientId: process.env.UBER_EATS_CLIENT_ID ?? "",
  clientSecret: process.env.UBER_EATS_CLIENT_SECRET ?? "",
  sandboxMode: isSandbox("uberEats"),
}

if (!credentials.clientId || !credentials.clientSecret) {
  console.error("Missing UBER_EATS_CLIENT_ID / UBER_EATS_CLIENT_SECRET in env")
  process.exit(1)
}

type Result = { name: string; status: "OK" | "FAIL" | "SKIP"; detail?: string }
const results: Result[] = []

async function run(name: string, fn: () => Promise<unknown>): Promise<void> {
  process.stdout.write(`▶ ${name} ... `)
  try {
    const out = await fn()
    const preview = typeof out === "object" ? JSON.stringify(out).slice(0, 120) : String(out)
    console.log(`OK ${preview ? `→ ${preview}` : ""}`)
    results.push({ name, status: "OK", detail: preview })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`FAIL → ${msg}`)
    results.push({ name, status: "FAIL", detail: msg })
  }
}

async function skip(name: string, reason: string): Promise<void> {
  console.log(`⏭  ${name} ... SKIP (${reason})`)
  results.push({ name, status: "SKIP", detail: reason })
}

async function main() {
  console.log(`Uber Eats validation runner`)
  console.log(`  Mode:        ${credentials.sandboxMode ? "sandbox" : "production"}`)
  console.log(`  Client ID:   ${credentials.clientId.slice(0, 12)}…`)
  console.log(`  Test store:  ${TEST_STORE_UUID}`)
  console.log()

  // 1. OAuth — implicit on first call
  await run("OAuth token fetch", () => uberEats.getAccessToken(credentials))

  // 2. Integration Config: Get Stores
  await run("Integration Config: Get Stores", () =>
    uberEats.getStoresForUser(credentials, { limit: 10 })
  )

  // 3. Integration Config: Get Integration Details
  await run("Integration Config: Get Integration Details", () =>
    uberEats.getIntegrationDetails(credentials, TEST_STORE_UUID)
  )

  // 4. Integration Config: Activate Integration (idempotent)
  await run("Integration Config: Activate Integration", () =>
    uberEats.activateIntegration(credentials, TEST_STORE_UUID, {
      integration_enabled: true,
      integrator_store_id: "beindigital-test-store",
      integrator_brand_id: "beindigital",
    })
  )

  // 5. Menu: Update Item — requires a real menu item to exist on the store.
  const testItemId = process.env.UBER_EATS_TEST_ITEM_ID
  if (testItemId) {
    await run("Menu: Update Item", () =>
      uberEats.updateMenuItem(credentials, TEST_STORE_UUID, testItemId, {
        suspension_info: { suspension: { reason: "OUT_OF_STOCK" } },
      })
    )
  } else {
    await skip("Menu: Update Item", "set UBER_EATS_TEST_ITEM_ID env to run")
  }

  // 6. Promotions: Create
  await run("Promotions: Create", () =>
    uberEats.createPromotion(credentials, TEST_STORE_UUID, {
      promotion_type: "FLAT_DISCOUNT",
      discount_amount: { amount: 200, currency_code: "EUR" },
      start_time: new Date(Date.now() + 60_000).toISOString(),
      end_time: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
    })
  )

  // 7. Reporting: Request report
  await run("Reporting: Request report", () =>
    uberEats.requestReport(credentials, {
      report_type: "PAYMENT_DETAILS_REPORT",
      start_date: "2026-05-01",
      end_date: "2026-05-15",
      store_uuids: [TEST_STORE_UUID],
    })
  )

  // 8-12. Order-bound endpoints — need a live order ID
  const orderId = process.env.UBER_EATS_TEST_ORDER_ID
  if (orderId) {
    await run("Order: Get Order Details", () => uberEats.fetchOrder(credentials, orderId))
    await run("Order: Accept Order", () => uberEats.acceptOrder(credentials, orderId))
    await run("Order: Mark Order as Ready", () => uberEats.markOrderAsReady(credentials, orderId))
    await run("Order: Resolve Fulfillment Issues", () =>
      uberEats.resolveFulfillmentIssues(credentials, orderId, {
        fulfillment_issues: [],
      })
    )
    // Deny and Cancel are destructive — run only if explicitly enabled.
    if (process.env.UBER_EATS_RUN_DESTRUCTIVE === "true") {
      await run("Order: Deny Order", () =>
        uberEats.denyOrder(credentials, orderId, {
          code: "ITEM_AVAILABILITY",
          explanation: "Validation test",
        })
      )
      await run("Order: Cancel Order", () =>
        uberEats.cancelOrder(credentials, orderId, {
          code: "OUT_OF_ITEMS",
          explanation: "Validation test",
        })
      )
    } else {
      await skip("Order: Deny / Cancel", "set UBER_EATS_RUN_DESTRUCTIVE=true to run")
    }
  } else {
    await skip("Order endpoints (Get/Accept/Ready/Deny/Cancel/Resolve)", "place a test order on the sandbox, then set UBER_EATS_TEST_ORDER_ID")
  }

  console.log("\n=== Summary ===")
  for (const r of results) {
    const icon = r.status === "OK" ? "✓" : r.status === "FAIL" ? "✗" : "⏭"
    console.log(`${icon} ${r.status.padEnd(4)} ${r.name}`)
  }
  const failed = results.filter((r) => r.status === "FAIL")
  if (failed.length > 0) {
    console.log(`\n${failed.length} call(s) failed.`)
    process.exit(2)
  }
}

main().catch((err) => {
  console.error("Runner crashed:", err)
  process.exit(1)
})
