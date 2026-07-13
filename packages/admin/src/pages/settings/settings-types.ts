// ---------------------------------------------------------------------------
// Shared types for the settings page and its tab sections
// ---------------------------------------------------------------------------

export type HelpStep = { text: string }
export type HelpLink = { label: string; url: string }

export interface FieldInfoProps {
  title: string
  description: string
  steps: HelpStep[]
  links?: HelpLink[]
  note?: string
}

export type PaymentConnection = {
  _id: string
  provider: "stripe" | "sumup" | "paypal"
  merchantId: string
  status: "connected" | "disconnected" | "error"
  connectedAt: number
  updatedAt: number
}

export type StoreHours = Array<{
  day: number
  open: string
  close: string
  isClosed: boolean
}>

export type SimulationResult = {
  uberDirectCost: number
  clientFee: number
  restaurantLoss: number
  estimatedMinutes: number
}
