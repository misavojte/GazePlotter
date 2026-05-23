/** Cardinal direction for placing a floating element relative to its anchor. */
export type Position = 'top' | 'bottom' | 'left' | 'right'

/** Alignment along the cross-axis. */
export type Alignment = 'start' | 'center' | 'end'

/** A 2-D point in viewport coordinates. */
export interface Point {
  x: number
  y: number
}

/** Width × height dimensions. */
export interface Dimensions {
  width: number
  height: number
}

/** Result of viewport-adjusted placement. */
export interface PlacementResult {
  left: number
  top: number
  isFlippedX: boolean
  isFlippedY: boolean
}
