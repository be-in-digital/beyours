/**
 * Deliveroo store availability and stock management
 */

import type { DeliverooCredentials } from "./types"
import { fetchDeliveroo, validatePathParam } from "./client"
import { IntegrationError } from "../common/errors"

export type DeliverooStoreStatus = "ONLINE" | "PAUSED" | "OFFLINE"

/**
 * Update store status on Deliveroo
 */
export async function updateStoreStatus(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string,
  status: DeliverooStoreStatus
): Promise<void> {
  const deliverooStatus = status === "ONLINE" ? "open"
    : status === "PAUSED" ? "paused"
    : "closed"

  const response = await fetchDeliveroo(
    credentials,
    `/v1/brands/${validatePathParam(brandId, "brandId")}/sites/${validatePathParam(siteId, "siteId")}/status`,
    { method: "PUT", body: { status: deliverooStatus } },
    "site"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to update Deliveroo store status",
      response.status,
      "deliveroo",
      errorText
    )
  }
}

/**
 * Set items as unavailable on Deliveroo
 */
export async function setItemsUnavailable(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return

  const response = await fetchDeliveroo(
    credentials,
    `/v1/brands/${validatePathParam(brandId, "brandId")}/sites/${validatePathParam(siteId, "siteId")}/unavailabilities`,
    {
      method: "PUT",
      body: {
        unavailable_items: itemIds.map(id => ({ item_id: id }))
      }
    },
    "site"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to set Deliveroo items unavailable",
      response.status,
      "deliveroo",
      errorText
    )
  }
}

/**
 * Clear all unavailabilities (make all items available again)
 */
export async function clearUnavailabilities(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string
): Promise<void> {
  const response = await fetchDeliveroo(
    credentials,
    `/v1/brands/${validatePathParam(brandId, "brandId")}/sites/${validatePathParam(siteId, "siteId")}/unavailabilities`,
    { method: "PUT", body: { unavailable_items: [] } },
    "site"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to clear Deliveroo unavailabilities",
      response.status,
      "deliveroo",
      errorText
    )
  }
}
