/**
 * Deliveroo order management API calls
 * Uses v1 Order API endpoints (matching Deliveroo sandbox)
 */

import type { DeliverooCredentials, DeliverooWebhookOrder } from "./types"
import { fetchDeliveroo, validatePathParam } from "./client"
import { IntegrationError } from "../common/errors"

// === Types ===

export type DeliverooOrderStatus =
  | "pending" | "accepted" | "confirmed" | "rejected"
  | "preparing" | "ready_for_pickup" | "picked_up"
  | "delivered" | "cancelled"

export type DeliverooPrepStage = "in_kitchen" | "ready"

export type DeliverooSyncStatus = "succeeded" | "failed"

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
 * Accept an order via PATCH /v1/orders/{id} with { status: "accepted" }
 */
export async function acceptOrder(
  credentials: DeliverooCredentials,
  orderId: string
): Promise<void> {
  const safeId = validatePathParam(orderId, "orderId")
  const response = await fetchDeliveroo(
    credentials,
    `/v1/orders/${safeId}`,
    { method: "PATCH", body: { status: "accepted" } },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to accept Deliveroo order ${orderId}`,
      response.status,
      "deliveroo",
      errorText
    )
  }
}

/**
 * Confirm a scheduled order via PATCH /v1/orders/{id} with { status: "confirmed" }
 * Should only be called after confirm_at time has passed.
 */
export async function confirmOrder(
  credentials: DeliverooCredentials,
  orderId: string
): Promise<void> {
  const safeId = validatePathParam(orderId, "orderId")
  const response = await fetchDeliveroo(
    credentials,
    `/v1/orders/${safeId}`,
    { method: "PATCH", body: { status: "confirmed" } },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to confirm Deliveroo order ${orderId}`,
      response.status,
      "deliveroo",
      errorText
    )
  }
}

/**
 * Reject an order via PATCH /v1/orders/{id} with { status: "rejected", reject_reason }
 */
export async function rejectOrder(
  credentials: DeliverooCredentials,
  orderId: string,
  reason: string = "store_busy"
): Promise<void> {
  const safeId = validatePathParam(orderId, "orderId")
  const response = await fetchDeliveroo(
    credentials,
    `/v1/orders/${safeId}`,
    { method: "PATCH", body: { status: "rejected", reject_reason: reason } },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to reject Deliveroo order ${orderId}`,
      response.status,
      "deliveroo",
      errorText
    )
  }
}

/**
 * Send sync status for an order (confirm items are mapped to POS)
 * POST /v1/orders/{id}/sync_status
 */
export async function sendSyncStatus(
  credentials: DeliverooCredentials,
  orderId: string,
  status: DeliverooSyncStatus,
  failureReason?: DeliverooSyncFailureReason,
  notes?: string
): Promise<void> {
  const safeId = validatePathParam(orderId, "orderId")
  const body: Record<string, unknown> = {
    status,
    reason: failureReason,
    notes,
    occurred_at: new Date().toISOString(),
  }

  try {
    const response = await fetchDeliveroo(
      credentials,
      `/v1/orders/${safeId}/sync_status`,
      { method: "POST", body },
      "order"
    )
    // 409 means sync status already finalized — not an error
    if (response.status === 409) {
      return
    }
    if (!response.ok) {
      const errorText = await response.text()
      throw new IntegrationError(
        `Failed to send sync status for Deliveroo order ${orderId}`,
        response.status,
        "deliveroo",
        errorText
      )
    }
  } catch (error) {
    if (error instanceof IntegrationError) throw error
    throw new IntegrationError(
      `Failed to send sync status for Deliveroo order ${orderId}`,
      0,
      "deliveroo",
      String(error)
    )
  }
}

/**
 * Update prep stage for an order
 * POST /v1/orders/{id}/prep_stages
 */
export async function updatePrepStage(
  credentials: DeliverooCredentials,
  orderId: string,
  stage: DeliverooPrepStage
): Promise<void> {
  const safeId = validatePathParam(orderId, "orderId")
  const response = await fetchDeliveroo(
    credentials,
    `/v1/orders/${safeId}/prep_stages`,
    {
      method: "POST",
      body: {
        stage,
        occurred_at: new Date().toISOString(),
      },
    },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to update prep stage for Deliveroo order ${orderId}`,
      response.status,
      "deliveroo",
      errorText
    )
  }
}

/**
 * Get order details
 * GET /v1/orders/{id}
 */
export async function getOrder(
  credentials: DeliverooCredentials,
  orderId: string
): Promise<DeliverooWebhookOrder> {
  const safeId = validatePathParam(orderId, "orderId")
  const response = await fetchDeliveroo(
    credentials,
    `/v1/orders/${safeId}`,
    { method: "GET" },
    "order"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to get Deliveroo order ${orderId}`,
      response.status,
      "deliveroo",
      errorText
    )
  }
  return response.json() as Promise<DeliverooWebhookOrder>
}
