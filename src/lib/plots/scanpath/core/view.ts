import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { figureView, type PlotView } from '$lib/plots/definePlot'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import { trailLengthOf } from '$lib/plots/shared/playbackFields'
import ScanpathPlotFigure from '../components/ScanpathPlotFigure.svelte'
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

/** Single source of truth for "what a scanpath draws" from (engine, settings). */
export function deriveScanpathView(
  engine: DataEngine,
  settings: ScanpathPlotSettings
): PlotView {
  const result = getScanpathData(engine, settings)
  const { showFixationOrder, showNumbers } = settings
  if (result.kind !== 'ok') {
    return figureView(ScanpathPlotFigure, {
      data: null,
      showFixationOrder,
      showNumbers,
      unavailableMessage: PLACEHOLDERS[result.reason],
    })
  }
  return figureView(ScanpathPlotFigure, {
    data: result.data,
    showFixationOrder,
    showNumbers,
    // Unset settings fall to the figure's defaults.
    colorMode: settings.colorMode,
    colorScale: settings.colorScale,
    solidColor: settings.solidColor,
    background: settings.background,
    trailLength: trailLengthOf(settings, engine),
    playbackSpeed: settings.playbackSpeed,
    timelineStart: settings.timelineStart,
    timelineEnd: settings.timelineEnd,
    unavailableMessage: null,
    // Only on the drawable branch: a parked placeholder draws no overlay.
    participantId: settings.participantId,
    // The stimulus's reference medium (image/video), drawn as the plot
    // background; its intrinsic pixel size becomes the coordinate domain.
    media: engine.metadata?.stimuliMedia?.[settings.stimulusId] ?? null,
    mediaStimulusId: settings.stimulusId,
  })
}
