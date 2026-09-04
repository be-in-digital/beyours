/**
 * Deliveroo site status, busy mode and item availability (86'ing).
 *
 * Endpoints here follow the Deliveroo Site API and Menu API contracts:
 * - Site status:        PUT  /v1/brands/{brandId}/sites/{siteId}/status
 * - Availability (all): PUT  /v2/brands/{brandId}/sites/{siteId}/menu/item-unavailabilities
 * - Availability (one): POST /v1/brands/{brandId}/menus/{menuId}/item-unavailabilities/{siteId}
 *
 * Availability lives in Deliveroo's MENU API, not the Site API, so those two
 * calls route through the `menu` base — the same one `pushMenu` and
 * `setPLUMappings` use, and `setPLUMappings` is the precedent for a
 * `/brands/{b}/sites/{s}/...` path that is nonetheless a menu concern. Open
 * and close is Site API and keeps the `site` base.
 *
 * Both base URLs already carry their `/menu` or `/site` prefix (see
 * DELIVEROO_URLS), so the paths below start at the version segment.
 */

import type { DeliverooCredentials } from "./types"
import { fetchDeliveroo, validatePathParam } from "./client"
import { IntegrationError } from "../common/errors"

/**
 * Cross-platform store status vocabulary used by the engine.
 *
 * Deliveroo does NOT have a "paused" site status — the Site API enum is
 * OPEN | CLOSED | READY_TO_OPEN. Busy mode is a separate knob that only
 * selects which prep-time value applies; it does not stop orders. So both
 * PAUSED and OFFLINE map to CLOSED — a real pause and a shutdown are the same
 * call on this platform.
 */
export type DeliverooStoreStatus = "ONLINE" | "PAUSED" | "OFFLINE"

/** The status enum the Deliveroo Site API actually accepts. */
export type DeliverooSiteStatus = "OPEN" | "CLOSED" | "READY_TO_OPEN"

/**
 * Item availability statuses. Deliveroo has three string statuses and no
 * snooze timer — an item is either orderable, greyed out, or hidden.
 */
export type DeliverooItemAvailability = "available" | "unavailable" | "hidden"

export interface DeliverooItemUnavailabilities {
  /** Items shown but not orderable ("sold out"). */
  unavailable_ids: string[]
  /** Items removed from the menu entirely. */
  hidden_ids: string[]
}

function siteResource(brandId: string, siteId: string): string {
  return `/v1/brands/${validatePathParam(brandId, "brandId")}/sites/${validatePathParam(siteId, "siteId")}`
}

async function assertOk(response: Response, message: string): Promise<void> {
  if (response.ok) return
  const errorText = await response.text()
  throw new IntegrationError(message, response.status, "deliveroo", errorText)
}

/**
 * Set the site's open/closed state using the Deliveroo Site API enum.
 *
 * A site cannot be opened outside its configured opening hours — the API
 * rejects that with an OPENING_HOURS closure reason.
 */
export async function updateSiteStatus(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string,
  status: DeliverooSiteStatus
): Promise<void> {
  const response = await fetchDeliveroo(
    credentials,
    `${siteResource(brandId, siteId)}/status`,
    { method: "PUT", body: { status } },
    "site"
  )
  await assertOk(response, "Failed to update Deliveroo site status")
}

/**
 * Update store status from the engine's cross-platform vocabulary.
 *
 * ONLINE → OPEN; PAUSED and OFFLINE → CLOSED. Deliveroo has no intermediate
 * "paused" state, so a temporary pause and a shutdown are the same call here.
 */
export async function updateStoreStatus(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string,
  status: DeliverooStoreStatus
): Promise<void> {
  const siteStatus: DeliverooSiteStatus = status === "ONLINE" ? "OPEN" : "CLOSED"
  await updateSiteStatus(credentials, brandId, siteId, siteStatus)
}

/**
 * Replace the ENTIRE availability state for a site (full reconcile).
 *
 * PUT is a replace, not a delta: every item NOT listed here is set back to
 * `available`. That is deliberate for menu sync — we hold the authoritative
 * stock state in Convex, so a full replace both marks new sell-outs AND
 * restocks anything that came back, in one call, with no drift.
 *
 * Do NOT use this to 86 a single dish in response to one stock change: it
 * would silently un-86 everything else the kitchen had marked out. Use
 * `setItemAvailability` (POST delta) for that.
 *
 * Note: Deliveroo auto-resets `unavailable` items to `available` at site
 * opening if nothing changed availability between midnight and open, so this
 * reconcile should be re-run at opening time.
 */
export async function setItemsUnavailable(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string,
  unavailableIds: string[],
  hiddenIds: string[] = []
): Promise<void> {
  const response = await fetchDeliveroo(
    credentials,
    `/v2/brands/${validatePathParam(brandId, "brandId")}/sites/${validatePathParam(siteId, "siteId")}/menu/item-unavailabilities`,
    {
      method: "PUT",
      body: {
        unavailable_ids: unavailableIds,
        hidden_ids: hiddenIds,
      } satisfies DeliverooItemUnavailabilities,
    },
    "menu"
  )
  await assertOk(response, "Failed to set Deliveroo items unavailable")
}

/**
 * Change availability for specific items only, leaving every other item
 * untouched (per-item delta).
 *
 * This is the call to make when one dish sells out or is restocked. Sending
 * `available` is how an item is un-86'd.
 */
export async function setItemAvailability(
  credentials: DeliverooCredentials,
  brandId: string,
  menuId: string,
  siteId: string,
  updates: Array<{ itemId: string; status: DeliverooItemAvailability }>
): Promise<void> {
  if (updates.length === 0) return

  const response = await fetchDeliveroo(
    credentials,
    `/v1/brands/${validatePathParam(brandId, "brandId")}/menus/${validatePathParam(menuId, "menuId")}/item-unavailabilities/${validatePathParam(siteId, "siteId")}`,
    {
      method: "POST",
      body: {
        item_unavailabilities: updates.map((u) => ({
          item_id: u.itemId,
          status: u.status,
        })),
      },
    },
    "menu"
  )
  await assertOk(response, "Failed to update Deliveroo item availability")
}

/**
 * Make every item available again (full reconcile with empty lists).
 */
export async function clearUnavailabilities(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string
): Promise<void> {
  await setItemsUnavailable(credentials, brandId, siteId, [], [])
}
