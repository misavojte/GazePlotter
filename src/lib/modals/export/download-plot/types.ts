/**
 * Standard export props that plot figures accept.
 * Width and height are the TOTAL canvas size (the user-typed export dimensions).
 * Figures treat `width`/`height` as total and carve the margins out of it, so the
 * exported image is exactly `width × height`.
 */
export interface PlotExportProps {
  /** Total canvas width in px (margins are carved out of this, not added). */
  width: number
  /** Total canvas height in px (margins are carved out of this, not added). */
  height: number
  /** DPI setting for high-resolution export */
  dpiOverride: number
  /** Top margin in pixels */
  marginTop: number
  /** Right margin in pixels */
  marginRight: number
  /** Bottom margin in pixels */
  marginBottom: number
  /** Left margin in pixels */
  marginLeft: number
}
