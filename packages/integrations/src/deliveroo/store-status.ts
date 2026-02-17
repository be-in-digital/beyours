/**
 * Deliveroo store availability and stock management
 */

import type { DeliverooCredentials } from "./types"
import { fetchDeliveroo } from "./client"

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
    `/v1/brands/${brandId}/sites/${siteId}/status`,
    { method: "PUT", body: { status: deliverooStatus } },
    "site"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to update store status (${response.status}): ${errorText}`)
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
    `/v1/brands/${brandId}/sites/${siteId}/unavailabilities`,
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
    throw new Error(`Failed to set items unavailable (${response.status}): ${errorText}`)
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
    `/v1/brands/${brandId}/sites/${siteId}/unavailabilities`,
    { method: "PUT", body: { unavailable_items: [] } },
    "site"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to clear unavailabilities (${response.status}): ${errorText}`)
  }
}
