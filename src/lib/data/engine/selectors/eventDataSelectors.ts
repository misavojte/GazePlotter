import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'

/**
 * Returns true if the stimulus has any event channels defined.
 */
export const hasEventsForStimulus = (
  engine: DataEngine,
  stimulusId: number
): boolean => {
  return engine.hasEventsPerStimulus[stimulusId] ?? false
}

/**
 * Returns interpreted event channel objects for a stimulus, respecting order vector.
 * Mirrors getAois() pattern.
 */
export const getEventChannels = (
  engine: DataEngine,
  stimulusId: number
): ExtendedInterpretedDataType[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const channels = meta.eventData.data[stimulusId]
  if (!channels || channels.length === 0) return []

  const order = meta.eventData.orderVector?.[stimulusId]
  const ids =
    order && order.length > 0
      ? order
      : Array.from({ length: channels.length }, (_, i) => i)

  const result: ExtendedInterpretedDataType[] = new Array(ids.length)
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const ch = channels[id]
    if (!ch) continue
    result[i] = {
      id,
      originalName: ch[0] ?? '',
      displayedName: ch[1] ?? ch[0] ?? '',
      color: ch[2] ?? '#888888',
    }
  }
  return result
}

/**
 * Returns the stride-2 event buffer [start, duration, ...] for a specific channel and participant.
 * Returns null if channel has no events for this participant.
 */
export const getEventBuffer = (
  engine: DataEngine,
  stimulusId: number,
  channelId: number,
  participantId: number
): number[] | null => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const buffer = meta.eventData.events[stimulusId]?.[channelId]?.[participantId]
  if (!buffer || buffer.length === 0) return null
  return buffer
}
