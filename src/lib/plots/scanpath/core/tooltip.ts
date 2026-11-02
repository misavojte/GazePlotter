import { gazePositionRow } from '$lib/plots/shared/labels'
import type { ScanpathFixation } from '../types'

/** The fixation tooltip rows, embedded by the kit's `hit`. */
export const buildScanpathTooltipContent = (
  fixation: ScanpathFixation
): Array<{ key: string; value: string }> => [
  { key: 'Fixation order', value: fixation.rank.toString() },
  { key: 'Start', value: `${fixation.start.toFixed(1)} ms` },
  { key: 'End', value: `${(fixation.start + fixation.duration).toFixed(1)} ms` },
  { key: 'Duration', value: `${fixation.duration.toFixed(1)} ms` },
  gazePositionRow(fixation.x, fixation.y),
]
