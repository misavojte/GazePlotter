export type RecurrenceMethod = 'fixedDistance' | 'fixedGrid' | 'aoi'

export type RecurrenceHighlight =
  | 'none'
  | 'diagonal'
  | 'horizontal'
  | 'vertical'

export type RecurrenceMasking = 'none' | 'diagonal' | 'diagonalLower'

export type RecurrencePlotSettings = {
  stimulusId: number
  participantId: number
  /** Per-plot AOI SELECTION id; unset/0 = all AOIs. */
  aoiSelectionId?: number
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

export interface RecurrenceData {
  /** Flat NxN binary matrix (1 = recurrent, 0 = not) */
  matrix: Uint8Array
  /** Flat NxN duration-weighted matrix (t_i + t_j when recurrent), or null */
  durationMatrix: Float32Array | null
  /** Number of fixations (N) */
  fixationCount: number
  /** Per-fixation primary AOI color (hex string), null if no AOI */
  fixationAoiColors: (string | null)[]
  /** Per-fixation absolute onset / end (ms), ascending. Resolves a shared TIME to
   *  the fixation it falls in; the gap between `ends[i]` and `starts[i+1]` is the
   *  saccade, where this participant was fixating nothing. */
  fixationStarts: Float64Array
  fixationEnds: Float64Array
}

export interface FixationRecord {
  x: number
  y: number
  /** Absolute onset (ms from this participant's first sample on the stimulus).
   *  NEVER a cumulative sum of durations — that ignores saccades and gaps. */
  start: number
  duration: number
  aoiIds: number[]
}
