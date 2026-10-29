import { UI_COLORS } from '$lib/color'

export const FIXATION_HEATMAP_LAYOUT = {
  tickCount: 5,
  /** The low end fades in over this share of the scale (smoothstep), so blobs
      have soft edges and a lone fixation under a dominant hot spot stays visible. */
  fadeTop: 0.05,
  /** Opacity map's auto scale top as a share of the peak: Pro Lab's default
      Scale max of 0.5, so the most-viewed areas show clear, not just the peak. */
  maskAutoTopShare: 0.5,
  /** LUT entries: fine enough that the fade ramp has ~50 alpha steps. */
  lutSize: 1024,
  /** Legend bar samples of the LUT, composited over white like the map. */
  legendStops: 32,
  tooltipWidth: 170,
  /** Auto radius as a share of the longer side of the robust fixation extent. */
  autoRadiusShare: 0.05,
  /** Robust extent bounds: 1st and 99th percentile per axis. */
  robustQuantile: 0.01,
  /** Without media the view clamps outliers beyond this share of the robust
      extent past each of its edges. */
  outlierMargin: 0.5,
} as const

export const FIXATION_HEATMAP_COLORS = {
  dot: UI_COLORS.INK,
  dotHalo: '#ffffff',
  dotAlpha: 0.7,
  /** Opacity map mask, Pro Lab's default. */
  mask: '#000000',
} as const
