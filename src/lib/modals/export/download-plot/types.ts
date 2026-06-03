import type { CanvasPlotMargins } from '$lib/plots/shared'

/**
 * Standard export props that plot figures accept.
 * Width and height are the TOTAL canvas size (the user-typed export dimensions).
 * Figures treat `width`/`height` as total and carve `margins` out of it, so the
 * exported image is exactly `width × height`.
 */
export interface PlotExportProps {
  /** Total canvas width in px (margins are carved out of this, not added). */
  width: number
  /** Total canvas height in px (margins are carved out of this, not added). */
  height: number
  /** DPI setting for high-resolution export */
  dpiOverride: number
  /** Export margins (the padding carved out of width/height). */
  margins: CanvasPlotMargins
}
