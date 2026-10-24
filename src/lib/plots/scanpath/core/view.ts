import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import ScanpathPlotFigure from '../components/ScanpathPlotFigure.svelte'
import { getScanpathData } from './transformer'
import type { ScanpathPlotSettings, ScanpathUnavailableReason } from '../types'

type ScanpathFigureProps = Omit<ComponentProps<typeof ScanpathPlotFigure>, keyof CanvasExportProps>

const PLACEHOLDERS: Record<ScanpathUnavailableReason, PlotPlaceholderContent> = {
  'no-spatial-data': {
    message: 'Missing spatial coordinate data:',
    steps: ['Upload a dataset containing spatial information'],
  },
  'no-fixations': 'No fixations recorded for this participant on this stimulus.',
  'no-spatial-coords': 'No spatial coordinates recorded for this participant on this stimulus.',
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
      colorMode: settings.colorMode ?? 'time',
      colorScale: settings.colorScale,
      playbackWindow: settings.playbackWindow ?? 0,
      playbackSpeed: settings.playbackSpeed ?? 1,
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
