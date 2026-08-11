import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { fixationLayerVisible, getParticipants } from '$lib/data/engine'
import ScarfPlotFigure from '../components/ScarfPlotFigure.svelte'
import { transformDataToScarfPlot } from './transformer'
import { isAoiLayerHighlight } from '../const'
import type { ScarfData, ScarfPlotSettings } from '../types'

const noop = () => {}

/**
 * The highlights the current view can honor. A gated fixation layer keeps its
 * styles (indices must not shift), so a stale AOI/No-AOI highlight would dim
 * every remaining band while ringing nothing — and with the Fixations legend
 * group omitted there is no affordance to un-toggle it. Fixation-layer
 * identifiers (AOI-prefixed, not category 'ac') are filtered whenever the
 * layer is gated; view-side only, so re-adding Fixation to the SELECTION
 * restores the highlight. Both highlight entry points (export here, the
 * screen recipe's live props) route through this.
 */
export function visibleHighlights(
  engine: DataEngine,
  settings: ScarfPlotSettings
): string[] {
  const highlights = settings.highlights ?? []
  if (
    highlights.length === 0 ||
    fixationLayerVisible(engine, settings.categorySelectionId)
  ) {
    return highlights
  }
  return highlights.filter(h => !isAoiLayerHighlight(h))
}

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
      highlights: visibleHighlights(engine, settings),
      onLegendClick: noop,
      onDragStepX: noop,
      onDragEnd: noop,
    },
  }
}
