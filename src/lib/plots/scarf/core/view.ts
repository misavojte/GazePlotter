import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { plotView, type PlotView } from '$lib/plots/definePlot'
import { fixationLayerVisible, getParticipantsIds } from '$lib/data/engine'
import { scarfKit } from './kit'
import { buildScarfTooltipContent } from './tooltip'
import { scarfDataMax, scarfRange, transformDataToScarfPlot } from './transformer'
import { isAoiLayerHighlight } from '../const'
import type { ScarfData, ScarfPlotSettings } from '../types'

/**
 * The highlights the current view can honor. A gated fixation layer keeps its
 * styles (indices must not shift), so a stale AOI/No-AOI highlight would dim
 * every remaining band while ringing nothing — and with the Fixations legend
 * group omitted there is no affordance to un-toggle it. Fixation-layer
 * identifiers (AOI-prefixed, not category 'ac') are filtered whenever the
 * layer is gated; view-side only, so re-adding Fixation to the SELECTION
 * restores the highlight.
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
 * The PLOT CURSOR's TIME scope: only 'absolute' x is elapsed ms — 'ordinal' is a
 * segment index and 'relative' a percent of each row's own session, so a shared
 * ms would be a lie in both. `null` keeps the plot out of BOTH directions, which
 * is why the kit carries no mode conditional.
 */
export const absoluteTimeScope = (settings: ScarfPlotSettings): number | null =>
  settings.timeline === 'absolute' ? settings.stimulusId : null

/**
 * True while the range is fully auto (no start, no end, no stimulus limits):
 * only then does the timeline sync. 'relative' is a fixed 0-100 scale.
 */
export function isAutoRange(settings: ScarfPlotSettings): boolean {
  if (settings.timeline === 'relative') return false
  const { start, end, limits } = scarfRange(settings)
  return !(start > 0 || end > 0) && !(Array.isArray(limits) && limits[1] > 0)
}

/** The data's own extent on the x axis (segment count or end time); 0 for 'relative'. */
export function scarfOwnMax(engine: DataEngine, settings: ScarfPlotSettings): number {
  if (settings.timeline === 'relative') return 0
  const ids = getParticipantsIds(engine, settings, settings.stimulusId)
  return scarfDataMax(engine, settings.stimulusId, ids, settings.timeline === 'ordinal')
}

/** The scarf segments for the (drafted and synced) settings; null when metadata isn't ready. */
export function getScarfData(engine: DataEngine, settings: ScarfPlotSettings): ScarfData | null {
  const meta = engine.metadata
  if (!meta) return null
  return transformDataToScarfPlot(
    engine,
    settings.stimulusId,
    getParticipantsIds(engine, settings, settings.stimulusId),
    settings,
    meta.noAoiTreatment
  )
}

/** What a scarf draws, screen and export; null when metadata isn't ready. */
export function scarfInput(engine: DataEngine, settings: ScarfPlotSettings) {
  const data = getScarfData(engine, settings)
  return (
    data && {
      data,
      settings,
      /** The data's own x extent, before any range or sync: a released pan ending at or past it commits auto. */
      dataMax: scarfOwnMax(engine, settings),
      getTooltipContent: (participantId: number, segmentOrderId: number) =>
        buildScarfTooltipContent(engine, settings.stimulusId, participantId, segmentOrderId),
    }
  )
}

/** Plus `highlights`, which the platform merges in (`view.viewOnly`). */
export type ScarfInput = NonNullable<ReturnType<typeof scarfInput>> & {
  highlights?: readonly string[]
}
export type ScarfView = PlotView<ScarfInput>

export function deriveScarfView(engine: DataEngine, settings: ScarfPlotSettings): ScarfView | null {
  const input = scarfInput(engine, settings)
  return input && plotView(scarfKit, input)
}
