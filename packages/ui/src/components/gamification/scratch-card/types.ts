export interface ScratchCardProps {
  prizeText: string
  didWin: boolean
  onReveal: () => void
  size?: number
  primaryColor?: string
  storeName?: string
  /** Whether the scratch layer responds to pointer events */
  interactive?: boolean
}
