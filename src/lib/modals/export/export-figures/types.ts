
/**
 * Canvas-sizing props the export host injects into a figure component, next to
 * the data props from `deriveView`. Width and height are the TOTAL canvas size;
 * figures carve `margins` out of it, so the exported image is exactly
 * `width × height`. `dpiOverride` scales the backing store (96 = 1x); `null`
 * uses the device pixel ratio (the on-screen preview).
 */
export interface PlotExportProps {
  width: number
  height: number
  dpiOverride: number | null
  margin: number
}
