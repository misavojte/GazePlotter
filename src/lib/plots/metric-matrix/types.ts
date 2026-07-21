/**
 * Metric Matrix settings. Rows = participants (one group), columns = every
 * stimulus, cell = one scalar `MetricInstance` value for that
 * (participant, stimulus). Deliberately has NO `stimulusId` — the plot spans
 * all stimuli, so the group-only subtitle and the absence of a 'stimulus'
 * pane section follow from this shape.
 */
export type MetricMatrixPlotSettings = {
  groupId: number
  /** Per-plot AOI SELECTION id; unset/0 = all AOIs. */
  aoiSelectionId?: number
  /** Per-plot stimulus SELECTION id; unset/0 = all stimuli. */
  stimulusSelectionId?: number
  /**
   * Single-select (the contract sets `multiSelect: false`); stored as an array
   * so the on-disk shape is uniform with every other metric-consuming plot.
   */
  metricInstanceIds: string[]
  /** Gradient stops (2 or 3 colors) for the finite-value mapping. */
  colorScale: string[]
  /**
   * `[min, max]`; `max === 0` means auto (data max). NON-optional: the
   * `scaleRange` field carries no self-default, so registration
   * (`assertSettingsSchema`) requires this key materialised in
   * `getDefaultSettings()`.
   */
  scaleRange: [number, number]
}

/**
 * Metric-INDEPENDENT quality classification of a (participant, stimulus) cell.
 *
 *   - `null`            a finite value (INCLUDING a legitimate 0) → gradient.
 *   - `absent`          no recording for this pair.
 *   - `no-fixations`    recording present but zero fixation segments (a capture
 *                       failure).
 *   - `aoi-not-present` the instance's AOI ref is undefined on this stimulus
 *                       (a benign config artifact).
 *   - `not-computable`  present + fixations, yet the metric is non-finite.
 *
 * `absent` / `no-fixations` are decided BEFORE the value is computed and
 * `aoi-not-present` / `not-computable` come from provenance/finiteness — never
 * from `value === 0` or `isFinite` alone — so the verdict never flips with the
 * chosen metric's measurement class.
 */
export type CellState =
  | null
  | 'absent'
  | 'no-fixations'
  | 'aoi-not-present'
  | 'not-computable'

export interface MetricMatrixAxisEntry {
  id: number
  label: string
}

export interface MetricMatrixData {
  /** Participants (y-axis), one row per recording id. */
  rows: MetricMatrixAxisEntry[]
  /** Stimuli (x-axis), in display order. */
  cols: MetricMatrixAxisEntry[]
  /** Row-major (rows × cols). `NaN` wherever `state[i] !== null`. */
  values: Float64Array
  /** Parallel to `values`; drives the fill bucket and the tooltip reason. */
  state: CellState[]
  /**
   * Parallel to `values`: the number of fixation segments behind each cell —
   * the sample size backing the metric value (a mean over 1 fixation vs 500 is
   * the trust signal the value alone hides). `-1` marks an absent recording (no
   * fixation count is meaningful); `0` marks a present-but-fixationless
   * recording; otherwise the fixation count (≥ 1).
   */
  fixations: Int32Array
  /** Metric unit (IUPAC quantity/unit), '' when dimensionless. */
  unit: string
  /** True when the metric id doesn't resolve / fails the scalar contract. */
  noMetric?: boolean
  /** Non-null when the grid is degenerate: no participants, no stimuli, all-NA. */
  empty?: 'no-rows' | 'no-cols' | 'all-na'
}
