/**
 * Add-visualization menu sections, by what a plot shows: where gaze landed
 * on the stimulus, the order AOIs were visited in, or a metric. Read in
 * exactly one place, the add-visualization menu (one heading per group, in
 * this order). It never appears in a plot's own chrome.
 */
export type PlotGroup = 'stimulus' | 'sequence' | 'metric'

export const PLOT_GROUPS: readonly { key: PlotGroup; label: string }[] = [
  { key: 'stimulus', label: 'Where they looked' },
  { key: 'sequence', label: 'Sequences' },
  { key: 'metric', label: 'Metrics' },
]
