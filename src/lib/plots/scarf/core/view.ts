import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { getParticipants } from '$lib/data/engine'
import ScarfPlotFigure from '../components/ScarfPlotFigure.svelte'
import { transformDataToScarfPlot } from './transformer'
import type { ScarfData, ScarfPlotSettings } from '../types'

const noop = () => {}

/**
 * Shared data derivation: transform the engine data into scarf segments for the
 * given (possibly sync-adjusted) settings. Returns null when metadata isn't
 * ready. The on-screen container calls this with its synced settings; the
 * export view-model calls it with the raw settings.
 */
export function getScarfData(
  engine: DataEngine,
  settings: ScarfPlotSettings
): ScarfData | null {
  const meta = engine.metadata
  if (!meta) return null
  const participantIds = getParticipants(engine, settings.groupId, settings.stimulusId).map(
    p => p.id
  )
  return transformDataToScarfPlot(
    engine,
    settings.stimulusId,
    participantIds,
    settings,
    meta.noAoiTreatment
  )
}

/** Export view-model — static (no drag/sync/tooltip interaction). */
export function deriveScarfView(
  engine: DataEngine,
  settings: ScarfPlotSettings
): PlotView | null {
  const data = getScarfData(engine, settings)
  if (!data) return null
  return {
    component: ScarfPlotFigure,
    props: {
      data,
      settings,
      highlights: settings.highlights ?? [],
      onLegendClick: noop,
      onTooltipActivation: noop,
      onTooltipDeactivation: noop,
      onDragStepX: noop,
      onDragEnd: noop,
    },
  }
}
