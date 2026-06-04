/**
 * Interface for plot dimensions in pixels
 */
export interface PlotDimensions {
  width: number
  height: number
}

import type { CanvasPlotMargins } from './usePlot.svelte'

/**
 * Props every canvas plot figure accepts for sizing and export. `width`/`height`
 * are the TOTAL canvas size; `margins` (the export padding) is carved out of them
 * (see `usePlot`). Figure Props interfaces should `extends CanvasExportProps`.
 */
export interface CanvasExportProps {
  width: number
  height: number
  dpiOverride?: number | null
  margins?: CanvasPlotMargins
}
