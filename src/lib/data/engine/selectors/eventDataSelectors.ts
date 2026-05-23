import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'

/**
 * Returns true if the stimulus has any event channels defined.
 */
export const hasEventsForStimulus = (
  engine: DataEngine,
  stimulusId: number
): boolean => {
  if (!engine.capabilities.event) return false
  return engine.eventsPerStimulus[stimulusId] ?? false
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

  return ids
    .map(id => {
      const ch = channels[id]
      if (!ch) return null
      return {
        id,
        originalName: ch[0] ?? '',
        displayedName: ch[1] ?? ch[0] ?? '',
        color: ch[2] ?? '#888888',
      }
    })
    .filter((ch): ch is ExtendedInterpretedDataType => ch !== null)
}

/**
 * Returns hidden event channel IDs for a stimulus.
 * Mirrors getHiddenAois() pattern.
 */
export const getHiddenEventChannels = (
  engine: DataEngine,
  stimulusId: number
): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return meta.eventData.hiddenChannels?.[stimulusId] ?? []
}

/**
 * Returns only visible (non-hidden) event channels for a stimulus, respecting order vector.
 * Mirrors getAois() pattern (visible-only).
 */
export const getVisibleEventChannels = (
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

  const hidden = meta.eventData.hiddenChannels?.[stimulusId] ?? []
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  return ids
    .filter(id => !hiddenSet?.has(id))
    .map(id => {
      const ch = channels[id]
      if (!ch) return null
      return {
        id,
        originalName: ch[0] ?? '',
        displayedName: ch[1] ?? ch[0] ?? '',
        color: ch[2] ?? '#888888',
      }
    })
    .filter((ch): ch is ExtendedInterpretedDataType => ch !== null)
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
