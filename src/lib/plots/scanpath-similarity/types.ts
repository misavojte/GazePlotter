import type { PlotItemContract } from '$lib/plots/definePlot'

export type ScanpathSimilarityView = 'matrix' | 'scangraph'

export type ScanpathSimilaritySettings = {
  stimulusId: number
  groupId: number
  /**
   * Slug(s) of the participant-pair-matrix MetricInstance(s) this plot renders.
   * Stored as an array for uniformity with multi-select plots; the contract
   * is single-select so length is 0 (none) or 1 (selected). The similarity
   * method and any preprocessing flags (e.g., collapsed AOIs) live on the
   * metric, not the plot.
   */
  metricInstanceIds: string[]
  timelineStart?: number
  timelineEnd?: number
  view: ScanpathSimilarityView
  /** Threshold parameter for scangraph adjacency (0-1) */
  threshold: number
  colorScale: string[]
  /** Per-stimulus color value ranges [min, max] */
  stimuliColorValueRanges: [number, number][]
  /** Highlighted participant node indices (scangraph) */
  participantHighlights?: number[]
}

export type ScanpathSimilarityItem = PlotItemContract<
  'scanpathSimilarity',
  ScanpathSimilaritySettings
>

export interface ScanpathSimilarityData {
  /** Participant labels (rows and columns) */
  labels: string[]
  /** Participant IDs matching labels */
  participantIds: number[]
  /** Flat row-major normalized similarity matrix (0-1, where 1 = identical) */
  matrix: Float64Array
  /** Size of the square matrix */
  size: number
  /** True when the plot's `metricInstanceIds[0]` points to a missing instance. */
  noMetric?: boolean
}

export interface ScangraphData {
  nodes: ScangraphNode[]
  links: ScangraphLink[]
}

export interface ScangraphNode {
  id: number
  label: string
  group: number
}

export interface ScangraphLink {
  source: number
  target: number
  value: number
}
