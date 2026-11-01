import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { plotView } from '$lib/plots/definePlot'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import { trailLengthOf } from '$lib/plots/shared/playbackFields'
import { scanpathKit } from './kit'
import { getScanpathData } from './transformer'
import type { ScanpathPlotSettings, ScanpathUnavailableReason } from '../types'

const PLACEHOLDERS: Record<ScanpathUnavailableReason, PlotPlaceholderContent> = {
  'no-spatial-data': {
    message: 'Missing spatial coordinate data:',
    steps: ['Upload a dataset containing spatial information'],
  },
  'no-fixations': {
    message: 'No fixations recorded for this participant on this stimulus.',
    steps: ['Pick another Participant or Stimulus'],
  },
  'no-spatial-coords': {
    message: 'No spatial coordinates recorded for this participant on this stimulus.',
    steps: ['Pick another Participant or Stimulus'],
  },
  'none-in-range': {
    message: 'No fixations in the selected time range.',
    steps: ['Widen the Time range', 'Pick another Participant or Stimulus'],
  },
}

/** What a scanpath draws, screen and export. */
export function scanpathInput(engine: DataEngine, settings: ScanpathPlotSettings) {
  const result = getScanpathData(engine, settings)
  const data = result.kind === 'ok' ? result.data : null
  // An ok result has at least one fixation; the last one ends the data.
  const last = data?.fixations[data.fixations.length - 1]
  return {
    settings,
    data,
    dataEnd: last ? last.start + last.duration : null,
    unavailableMessage: result.kind === 'ok' ? null : PLACEHOLDERS[result.reason],
    // Its intrinsic pixel size becomes the coordinate domain.
    media: engine.metadata?.stimuliMedia?.[settings.stimulusId] ?? null,
    trailLength: trailLengthOf(settings, engine),
  }
}

export type ScanpathInput = ReturnType<typeof scanpathInput>

export const deriveScanpathView = (engine: DataEngine, settings: ScanpathPlotSettings) =>
  plotView(scanpathKit, scanpathInput(engine, settings))
