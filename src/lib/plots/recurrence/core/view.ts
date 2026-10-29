import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import RecurrencePlotFigure from '../components/RecurrencePlotFigure.svelte'
import { aoiInEveryFixationPlaceholder, collectRecurrenceData } from './collector'
import { buildHighlightMask } from './highlightMask'
import type { RecurrencePlotSettings } from '../types'

export function deriveRecurrenceView(
  engine: DataEngine,
  settings: RecurrencePlotSettings
): PlotView {
  const { highlight, masking, minLineLength } = settings
  const data = collectRecurrenceData(engine, settings)
  const highlightMask = data
    ? buildHighlightMask(data.matrix, data.fixationCount, highlight, masking, minLineLength)
    : null
  return {
    component: RecurrencePlotFigure,
    props: {
      data,
      highlight,
      masking,
      highlightMask,
      warning: data
        ? aoiInEveryFixationPlaceholder(data.aoisInEveryFixation, engine.capabilities.spatial)
        : null,
      participantId: settings.participantId,
    } satisfies Omit<ComponentProps<typeof RecurrencePlotFigure>, keyof CanvasExportProps>,
  }
}
