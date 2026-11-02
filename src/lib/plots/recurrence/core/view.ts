import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { plotView } from '$lib/plots/definePlot'
import { aoiInEveryFixationPlaceholder, collectRecurrenceData } from './collector'
import { buildHighlightMask } from './highlightMask'
import { recurrenceKit } from './kit'
import type { RecurrencePlotSettings } from '../types'

export function recurrenceInput(engine: DataEngine, settings: RecurrencePlotSettings) {
  const { highlight, masking, minLineLength } = settings
  const data = collectRecurrenceData(engine, settings)
  return {
    data,
    settings,
    highlightMask: data
      ? buildHighlightMask(data.matrix, data.fixationCount, highlight, masking, minLineLength)
      : null,
    /** Replaces the matrix when it carries no information (an AOI in every fixation). */
    warning: data
      ? aoiInEveryFixationPlaceholder(data.aoisInEveryFixation, engine.capabilities.spatial)
      : null,
  }
}

export type RecurrenceInput = ReturnType<typeof recurrenceInput>

export const deriveRecurrenceView = (engine: DataEngine, settings: RecurrencePlotSettings) =>
  plotView(recurrenceKit, recurrenceInput(engine, settings))
