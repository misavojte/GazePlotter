import { formatGaze } from '$lib/plots/shared/labels'
import type { ScanpathFixation } from '../types'

/**
 * Pure content builder for the scanpath fixation tooltip. The figure's
 * `hitTest` embeds this into its `FrameHit`; the `usePlot` harness owns
 * showing, positioning, and hiding — same contract as every other plot
 * (see the scarf's `buildScarfTooltipContent`).
 */
export const buildScanpathTooltipContent = (
  fixation: ScanpathFixation
): Array<{ key: string; value: string }> => [
  { key: 'Fixation order', value: fixation.rank.toString() },
  { key: 'Start', value: `${fixation.start.toFixed(1)} ms` },
  { key: 'End', value: `${(fixation.start + fixation.duration).toFixed(1)} ms` },
  { key: 'Duration', value: `${fixation.duration.toFixed(1)} ms` },
  { key: 'X', value: formatGaze(fixation.x) },
  { key: 'Y', value: formatGaze(fixation.y) },
]
