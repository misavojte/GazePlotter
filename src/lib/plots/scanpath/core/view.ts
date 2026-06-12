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
  /** Figure props when the plot has data; null when unavailable. */
  props: ScanpathFigureProps | null
  /** Why the plot is unavailable (for the on-screen message); null when ok. */
  unavailableReason: ScanpathUnavailableReason | null
}

/** Single source of truth for "what a scanpath draws" from (engine, settings). */
export function getScanpathView(
  engine: DataEngine,
  settings: ScanpathPlotSettings
): ScanpathView {
  const result = getScanpathData(engine, settings)
  if (result.kind !== 'ok') {
    return { props: null, unavailableReason: result.reason }
  }
  return {
    props: {
      data: result.data,
      showFixationOrder: settings.showFixationOrder,
      showNumbers: settings.showNumbers,
    },
    unavailableReason: null,
  }
}

export function deriveScanpathView(
  engine: DataEngine,
  settings: ScanpathPlotSettings
): PlotView | null {
  const v = getScanpathView(engine, settings)
  return v.props ? { component: ScanpathPlotFigure, props: v.props as Record<string, unknown> } : null
}
