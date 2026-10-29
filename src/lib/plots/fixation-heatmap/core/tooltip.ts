import { formatGaze, gazePositionRow } from '$lib/plots/shared/labels'
import { formatAmount } from './view'
import type { FixationHeatmapAccumulate, FixationHeatmapNormalization } from '../types'

/** What lies within R of a hovered cell's centre, already summed by the figure. */
export interface HeatmapCellSummary {
  value: number
  x: number
  y: number
  radius: number
  fixations: number
  /** Summed fixation duration (or count) within R. */
  rawSum: number
  /** Mean per-participant share of their own total, 0..1. */
  share: number
  participants: number
  ofParticipants: number
  /** The largest contributor and their share of the cell, 0..1; null when none. */
  top: { name: string; share: number } | null
}

/**
 * Pure content builder for the heatmap cell tooltip, embedded by the figure's
 * `hitTest` (same contract as the scarf's `buildScarfTooltipContent`).
 */
export function buildHeatmapTooltipContent(
  c: HeatmapCellSummary,
  accumulate: FixationHeatmapAccumulate,
  normalization: FixationHeatmapNormalization
): Array<{ key: string; value: string }> {
  const duration = accumulate === 'duration'
  const unit = normalization === 'share' ? ' %' : duration ? ' ms per participant' : ' fixations per participant'
  const rows = [
    { key: 'Map value', value: `${formatAmount(c.value)}${unit}` },
    {
      key: `Within R = ${formatGaze(c.radius)}`,
      value: `${c.fixations} fixation${c.fixations === 1 ? '' : 's'}${duration ? `, ${formatAmount(c.rawSum)} ms` : ''}`,
    },
    {
      key: duration ? 'Share of fixation time' : 'Share of fixations',
      value: `${formatAmount(100 * c.share)} %`,
    },
  ]
  // A lone participant is their own largest contributor, so name them inline.
  const lone = c.participants === 1 && c.top
  rows.push({
    key: 'Participants',
    value: `${c.participants} of ${c.ofParticipants}${lone ? ` (${c.top!.name})` : ''}`,
  })
  if (c.top && !lone) {
    rows.push({ key: 'Largest contributor', value: `${c.top.name}, ${Math.round(100 * c.top.share)} %` })
  }
  rows.push(gazePositionRow(c.x, c.y))
  return rows
}
