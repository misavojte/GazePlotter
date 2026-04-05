/**
 * Standard export props that plot figures accept.
 * Width and height represent the drawable export area after margins have been
 * removed by the export UI.
 */
export interface PlotExportProps {
  /** Content width (excluding margins) - plot figure adds margins to canvas size */
  width: number
  /** Content height (excluding margins) - plot figure adds margins to canvas size */
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
