import type { PlotItemContract } from '$lib/plots/definePlot'

export type RecurrenceMethod = 'fixedDistance' | 'fixedGrid' | 'aoi'

export type RecurrenceHighlight =
  | 'none'
  | 'diagonal'
  | 'horizontal'
  | 'vertical'

export type RecurrenceMasking = 'none' | 'diagonal' | 'diagonalLower'

export type RecurrencePlotSettings = {
  stimulusId: number
  groupId: number
  participantId: number
  recurrenceMethod: RecurrenceMethod
  radius: number
  gridSize: number
  showDuration: boolean
  minLineLength: number
  timelineStart?: number
  timelineEnd?: number
  highlight: RecurrenceHighlight
  masking: RecurrenceMasking
}

export type RecurrencePlotItem = PlotItemContract<
  'recurrencePlot',
  RecurrencePlotSettings
>

export interface RecurrenceData {
  /** Flat NxN binary matrix (1 = recurrent, 0 = not) */
  matrix: Uint8Array
  /** Flat NxN duration-weighted matrix (t_i + t_j when recurrent), or null */
  durationMatrix: Float32Array | null
  /** Number of fixations (N) */
  fixationCount: number
  /** Per-fixation primary AOI color (hex string), null if no AOI */
  fixationAoiColors: (string | null)[]
}

export interface FixationRecord {
  x: number
  y: number
  duration: number
  aoiIds: number[]
}
