export interface WheelSegment {
  label: string
  color: string
}

export interface FortuneWheelProps {
  segments: WheelSegment[]
  targetIndex: number | null
  spinning: boolean
  onSpinComplete: () => void
  size?: number
  primaryColor?: string
  didWin?: boolean
}
