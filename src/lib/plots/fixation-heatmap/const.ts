export const FIXATION_HEATMAP_LAYOUT = {
  tickCount: 5,
  /** The low end fades in over this share of the scale (smoothstep), so blobs
      have soft edges and a lone fixation under a dominant hot spot stays visible. */
  fadeTop: 0.05,
  /** LUT entries: fine enough that the fade ramp has ~50 alpha steps. */
  lutSize: 1024,
  /** Legend bar samples of the LUT, composited over white like the map. */
  legendStops: 32,
  /** Gap between the colour legend and the data summary. */
  summaryGapPx: 4,
  /** The data summary wraps instead of ellipsising, up to this many lines. */
  summaryMaxLines: 3,
  tooltipWidth: 220,
  /** Auto radius as a share of the longer side of the robust fixation extent. */
  autoRadiusShare: 0.05,
  /** Robust extent bounds: 1st and 99th percentile per axis. */
  robustQuantile: 0.01,
  /** Without media the view clamps outliers beyond this share of the robust
      extent past each of its edges. */
  outlierMargin: 0.5,
} as const

export const FIXATION_HEATMAP_COLORS = {
  dot: '#1f1f1f',
  dotHalo: '#ffffff',
  dotAlpha: 0.7,
  /** Grey whose zero saturation, composited with 'saturation', desaturates the image. */
  desaturate: '#808080',
  /** White under and over the image: the underlay, the dimming veil, an undrawn image's fill. */
  paper: '#ffffff',
  dimAlpha: 0.5,
  summaryText: '#666666',
} as const
