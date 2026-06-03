/**
 * Interface for plot dimensions in pixels
 */
export interface PlotDimensions {
  width: number
  height: number
}

/**
 * Props every canvas plot figure accepts for sizing and export. `width`/`height`
 * are the TOTAL canvas size; the export margins are carved out of them (see
 * `usePlot`). Figure Props interfaces should `extends CanvasExportProps`.
 */
export interface CanvasExportProps {
  width: number
  height: number
  dpiOverride?: number | null
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
}
