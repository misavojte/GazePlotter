/**
 * Plot taxonomy: the unit of analysis a plot is built around. This is the
 * human reading of the metric `outputShape` axis (scalar -> participant,
 * aoi-vector -> AOI, aoi-pair-matrix -> inter-AOI, participant-pair-matrix ->
 * inter-participant), extended to cover the raw-gaze plots that consume no
 * metric (their unit is the gaze itself, spatial or temporal).
 *
 * Read in exactly one place: the add-visualization menu groups plots by this
 * field. It never appears in a plot's own chrome.
 */
export type PlotGroup =
  | 'gaze-behavior'
  | 'per-aoi'
  | 'inter-aoi'
  | 'per-participant'
  | 'inter-participant'

/**
 * Ordered group list for the menu. The order pairs each entity with its inter-
 * counterpart (Per AOI -> Inter-AOI, Per participant -> Inter-participant) so
 * the menu itself teaches the entity x operation map. `label` is the menu
 * heading; the register is ET-field precise ("Inter-AOI", not "Between AOIs").
 */
export const PLOT_GROUPS: readonly { key: PlotGroup; label: string }[] = [
  { key: 'gaze-behavior', label: 'Gaze behavior' },
  { key: 'per-aoi', label: 'Per AOI' },
  { key: 'inter-aoi', label: 'Inter-AOI' },
  { key: 'per-participant', label: 'Per participant' },
  { key: 'inter-participant', label: 'Inter-participant' },
]
