/**
 * Deliveroo order management API calls
 */

import type { DeliverooCredentials, DeliverooWebhookOrder } from "./types"
import { fetchDeliveroo } from "./client"

// === Types ===

export type DeliverooOrderStatus =
  | "pending" | "accepted" | "confirmed" | "rejected"
  | "preparing" | "ready_for_pickup" | "picked_up"
  | "delivered" | "cancelled"

export type DeliverooPrepStage = "in_kitchen" | "ready"

export type DeliverooSyncStatus = "success" | "failure"

export type DeliverooSyncFailureReason =
  | "pos_item_id_not_found"
  | "pos_item_id_mismatched"
  | "price_mismatched"
  | "items_out_of_stock"
  | "location_offline"
  | "location_not_supported"
  | "unsupported_order_type"
  | "no_webhook_url"
  | "webhook_failed"
  | "timed_out"
  | "other"
  | "no_sync_confirmation"

// === API Functions ===

/**
 * Accept an order
 */
export async function acceptOrder(
  credentials: DeliverooCredentials,
  orderId: string
): Promise<void> {
  const response = await fetchDeliveroo(
    credentials,
    `/order/v2/orders/${orderId}/accept`,
    { method: "POST", body: {} },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to accept order ${orderId} (${response.status}): ${errorText}`)
  }
}

/**
 * Reject an order with reason
 */
export async function rejectOrder(
  credentials: DeliverooCredentials,
  orderId: string,
  reason: string = "store_busy"
): Promise<void> {
  const response = await fetchDeliveroo(
    credentials,
    `/order/v2/orders/${orderId}/reject`,
    { method: "POST", body: { reason } },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to reject order ${orderId} (${response.status}): ${errorText}`)
  }
}

/**
 * Send sync status for an order (confirm items are mapped to POS)
 */
export async function sendSyncStatus(
  credentials: DeliverooCredentials,
  orderId: string,
  status: DeliverooSyncStatus,
  failureReason?: DeliverooSyncFailureReason
): Promise<void> {
  const body: Record<string, unknown> = { status }
  if (status === "failure" && failureReason) {
    body.reason = failureReason
  }
  const response = await fetchDeliveroo(
    credentials,
    `/order/v2/orders/${orderId}/sync_status`,
    { method: "POST", body },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to send sync status for order ${orderId} (${response.status}): ${errorText}`)
  }
}

/**
 * Update prep stage for an order
 */
export async function updatePrepStage(
  credentials: DeliverooCredentials,
  orderId: string,
  stage: DeliverooPrepStage
): Promise<void> {
  const response = await fetchDeliveroo(
    credentials,
    `/order/v2/orders/${orderId}/prep_stage`,
    { method: "POST", body: { stage } },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to update prep stage for order ${orderId} (${response.status}): ${errorText}`)
  }
}

/**
 * Get order details
 */
export async function getOrder(
  credentials: DeliverooCredentials,
  orderId: string
): Promise<DeliverooWebhookOrder> {
  const response = await fetchDeliveroo(
    credentials,
    `/order/v2/orders/${orderId}`,
    { method: "GET" },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get order ${orderId} (${response.status}): ${errorText}`)
  }
  return response.json() as Promise<DeliverooWebhookOrder>
}
