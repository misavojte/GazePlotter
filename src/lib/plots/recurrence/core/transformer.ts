import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { RecurrencePlotSettings, RecurrenceData, RecurrenceMethod } from '../types'
import { collectRecurrenceData } from './collector'

export function getRecurrenceData(
  engine: DataEngine,
  settings: RecurrencePlotSettings
): RecurrenceData | null {
  const reader = engine.getReader()
  if (!reader) return null

  const method: RecurrenceMethod =
    !reader.hasSpatialData && settings.recurrenceMethod !== 'aoi'
      ? 'aoi'
      : settings.recurrenceMethod

  if (method !== 'aoi' && !reader.hasSpatialData) return null

  return collectRecurrenceData(
    engine,
    settings.stimulusId,
    settings.participantId,
    method,
    settings.radius,
    settings.gridSize,
    settings.showDuration,
    settings.minLineLength,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0,
  )
}
