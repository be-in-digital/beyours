/**
 * Delivery fee calculation utility
 *
 * Pure function for computing delivery fees based on fixed or percentage mode.
 * Used by both the order creation mutation and the admin simulator.
 */

export interface DeliveryFeeParams {
  feeMode: "fixed" | "percentage"
  fixedFee?: number       // cents (used when feeMode = "fixed")
  percentage?: number     // 1-100 (used when feeMode = "percentage")
  maxFee?: number         // cents, cap for percentage mode
  freeAbove?: number      // cents, threshold for free delivery
  orderSubtotal: number   // cents
  uberDirectFee?: number  // cents, from Uber Direct quote
}

export interface DeliveryFeeResult {
  clientFee: number             // cents — what the customer pays
  restaurantLoss: number        // cents — what the restaurant absorbs
  uberDirectCost: number | null // cents — actual Uber Direct charge
}

export function calculateDeliveryFee(params: DeliveryFeeParams): DeliveryFeeResult {
  const uberDirectCost = params.uberDirectFee ?? null

  // Free delivery threshold check
  if (params.freeAbove !== undefined && params.orderSubtotal >= params.freeAbove) {
    return {
      clientFee: 0,
      restaurantLoss: uberDirectCost ?? 0,
      uberDirectCost,
    }
  }

  let grossClientFee: number

  if (params.feeMode === "fixed") {
    grossClientFee = params.fixedFee ?? 0
  } else {
    // percentage mode
    if (uberDirectCost === null) {
      throw new Error("uberDirectFee is required when feeMode is percentage")
    }
    const pct = params.percentage ?? 100
    grossClientFee = Math.round((uberDirectCost * pct) / 100)
  }

  // Apply max fee cap
  const clientFee =
    params.maxFee !== undefined
      ? Math.min(grossClientFee, params.maxFee)
      : grossClientFee

  // Compute restaurant absorption
  const restaurantLoss =
    uberDirectCost !== null ? Math.max(0, uberDirectCost - clientFee) : 0

  return { clientFee, restaurantLoss, uberDirectCost }
}
