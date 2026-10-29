import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import ScanpathPlotFigure from '../components/ScanpathPlotFigure.svelte'
import { getScanpathData } from './transformer'
import { SCANPATH_LAYOUT } from '../const'
import type { ScanpathPlotSettings, ScanpathUnavailableReason } from '../types'

type ScanpathFigureProps = Omit<ComponentProps<typeof ScanpathPlotFigure>, keyof CanvasExportProps>

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

/** Trail length in ms: the set value, else a short one on a video and all on an image. */
export function scanpathTrail(settings: Partial<ScanpathPlotSettings>, engine: DataEngine): number {
  if (settings.trailLength !== undefined) return settings.trailLength
  const media = engine.metadata?.stimuliMedia?.[settings.stimulusId ?? 0]
  return media?.kind === 'video' ? SCANPATH_LAYOUT.videoTrailMs : 0
}

/** Single source of truth for "what a scanpath draws" from (engine, settings). */
export function deriveScanpathView(
  engine: DataEngine,
  settings: ScanpathPlotSettings
): PlotView {
  const result = getScanpathData(engine, settings)
  const { showFixationOrder, showNumbers } = settings
  if (result.kind !== 'ok') {
    const props = { data: null, showFixationOrder, showNumbers, unavailableMessage: PLACEHOLDERS[result.reason] }
    return { component: ScanpathPlotFigure, props: props satisfies ScanpathFigureProps }
  }
  return {
    component: ScanpathPlotFigure,
    props: {
      data: result.data,
      showFixationOrder,
      showNumbers,
      // Unset settings fall to the figure's defaults.
      colorMode: settings.colorMode,
      colorScale: settings.colorScale,
      solidColor: settings.solidColor,
      background: settings.background,
      trailLength: scanpathTrail(settings, engine),
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
    } satisfies ScanpathFigureProps,
  }
}
