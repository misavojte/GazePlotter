import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
import EvolvingMetricsPlotFigure from '../components/EvolvingMetricsPlotFigure.svelte'
import { getEvolvingMetricsData } from '.'
import type { EvolvingMetricsResult } from '../types'
import type { EvolvingMetricsSettings } from '../types'

/**
 * Shared data derivation (engine-only — no grid coupling): resolves the
 * timeline max from participant end-times, then transforms. Both the on-screen
 * container and the export view-model call this so they can't drift.
 */
export function computeEvolvingData(
  engine: DataEngine,
  settings: EvolvingMetricsSettings
): EvolvingMetricsResult {
  const timelineMax =
    (settings.timelineEnd ?? 0) > 0
      ? settings.timelineEnd!
      : getParticipants(engine, settings.groupId, settings.stimulusId).reduce(
          (max, p) => Math.max(max, getParticipantEndTime(engine, settings.stimulusId, p.id)),
          0
        )
  return getEvolvingMetricsData(engine, {
    ...settings,
    timelineMin: settings.timelineStart ?? 0,
    timelineMax,
  })
}

export function deriveEvolvingMetricsView(
  engine: DataEngine,
  settings: EvolvingMetricsSettings
): PlotView {
  return {
    component: EvolvingMetricsPlotFigure,
    props: {
      data: computeEvolvingData(engine, settings),
      alignment: settings.presentation ?? 'heatmap',
      colorScale: settings.colorScale,
    },
  }
}
