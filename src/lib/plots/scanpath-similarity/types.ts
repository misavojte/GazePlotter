import type { PlotItemContract } from '$lib/plots/definePlot'

export type SimilarityMethod = 'levenshtein' | 'needlemanWunsch'

export type ScanpathSimilarityView = 'matrix' | 'scangraph'

export type ScanpathSimilaritySettings = {
  stimulusId: number
  groupId: number
  similarityMethod: SimilarityMethod
  view: ScanpathSimilarityView
  /** Threshold parameter for scangraph adjacency (0-1) */
  threshold: number
  /** Whether to collapse consecutive identical AOIs */
  collapsed: boolean
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
