import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import ScanpathPlotFigure from '../components/ScanpathPlotFigure.svelte'
import { getScanpathData } from './transformer'
import type { ScanpathPlotSettings, ScanpathUnavailableReason } from '../types'

export type ScanpathFigureProps = Omit<
  ComponentProps<typeof ScanpathPlotFigure>,
  keyof CanvasExportProps
>

export interface ScanpathView {
  /** Figure props for the component. */
  props: ScanpathFigureProps
}

export type WarningPlaceholder = { message: string; steps?: string[] }

function messageForReason(
  reason: ScanpathUnavailableReason
): string | WarningPlaceholder {
  switch (reason) {
    case 'no-spatial-data':
      return {
        message: 'Missing spatial coordinate data:',
        steps: ['Upload a dataset containing spatial information'],
      }
    case 'no-fixations':
      return 'No fixations recorded for this participant on this stimulus.'
    case 'no-spatial-coords':
      return 'No spatial coordinates recorded for this participant on this stimulus.'
  }
}

/** Single source of truth for "what a scanpath draws" from (engine, settings). */
export function getScanpathView(
  engine: DataEngine,
  settings: ScanpathPlotSettings
): ScanpathView {
  const result = getScanpathData(engine, settings)
  if (result.kind !== 'ok') {
    return {
      props: {
        data: null,
        showFixationOrder: settings.showFixationOrder,
        showNumbers: settings.showNumbers,
        unavailableMessage: messageForReason(result.reason),
      },
    }
  }
  // The stimulus's reference medium (image/video), drawn as the plot
  // background; its intrinsic pixel size becomes the coordinate domain.
  const media = engine.metadata?.stimuliMedia?.[settings.stimulusId] ?? null
  return {
    props: {
      data: result.data,
      showFixationOrder: settings.showFixationOrder,
      showNumbers: settings.showNumbers,
      unavailableMessage: null,
      // Only on the drawable branch: a parked placeholder draws no overlay.
      participantId: settings.participantId,
      media,
      mediaStimulusId: settings.stimulusId,
    },
  }
}

export function deriveScanpathView(
  engine: DataEngine,
  settings: ScanpathPlotSettings
): PlotView {
  const v = getScanpathView(engine, settings)
  return { component: ScanpathPlotFigure, props: v.props as Record<string, unknown> }
}

