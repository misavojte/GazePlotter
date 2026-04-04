import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { RecurrencePlotSettings, RecurrenceData } from '../types'
import { collectRecurrenceData } from './collector'

export function getRecurrenceData(
  engine: DataEngine,
  settings: RecurrencePlotSettings
): RecurrenceData | null {
  const reader = engine.getReader()
  if (!reader?.hasSpatialData) return null

  return collectRecurrenceData(
    engine,
    settings.stimulusId,
    settings.participantId,
    settings.recurrenceMethod,
    settings.radius,
    settings.gridSize,
    settings.showDuration,
    settings.minLineLength
  )
}
