import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
import { INTERVAL_CHANNEL_MARKER } from '../eventIntervals'

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
 * Aggregated view of event channels across ALL stimuli, keyed by original
 * name — the unit the post-upload prune operates on ("remove MouseClick
 * everywhere"). occurrenceCount counts stride-2 buffer entries;
 * firstOnset is the earliest occurrence start anywhere (Infinity when the
 * channel has no occurrences) — `detectSuffixPair` uses it to orient
 * start/end suffix pairs. isInterval flags channels derived by the
 * Create-intervals step (marker at def index 3).
 */
export const getEventChannelSummary = (
  engine: DataEngine
): {
  name: string
  stimulusCount: number
  occurrenceCount: number
  firstOnset: number
  isInterval: boolean
}[] => {
  const meta = engine.metadata
  if (!meta) return []
  const ed = meta.eventData
  const byName = new Map<
    string,
    {
      stimulusCount: number
      occurrenceCount: number
      firstOnset: number
      isInterval: boolean
    }
  >()
  for (let s = 0; s < ed.data.length; s++) {
    const defs = ed.data[s] ?? []
    for (let c = 0; c < defs.length; c++) {
      const name = defs[c][0]
      let entry = byName.get(name)
      if (!entry) {
        entry = {
          stimulusCount: 0,
          occurrenceCount: 0,
          firstOnset: Infinity,
          isInterval: false,
        }
        byName.set(name, entry)
      }
      entry.stimulusCount++
      if (defs[c][3] === INTERVAL_CHANNEL_MARKER) entry.isInterval = true
      for (const buffer of ed.events[s]?.[c] ?? []) {
        entry.occurrenceCount += (buffer?.length ?? 0) / 2
        for (let i = 0; i + 1 < (buffer?.length ?? 0); i += 2) {
          if (buffer[i] < entry.firstOnset) entry.firstOnset = buffer[i]
        }
      }
    }
  }
  return Array.from(byName, ([name, counts]) => ({ name, ...counts }))
}

/**
 * Per-stimulus replacement payloads (for `updateEventData` commands) that
 * drop every channel whose original name is in `namesToRemove`. Stimuli
 * with no matching channel are omitted. `hiddenChannels` carries the
 * stimulus's hidden set remapped to the new ids — surviving channels stay
 * hidden across the re-indexing.
 */
export const buildEventDataWithoutChannels = (
  engine: DataEngine,
  namesToRemove: ReadonlySet<string>
): {
  stimulusId: number
  channelDefs: string[][]
  eventBuffers: number[][][]
  hiddenChannels: number[]
}[] => {
  const meta = engine.metadata
  if (!meta) return []
  const ed = meta.eventData
  const updates: {
    stimulusId: number
    channelDefs: string[][]
    eventBuffers: number[][][]
    hiddenChannels: number[]
  }[] = []
  for (let s = 0; s < ed.data.length; s++) {
    const defs = ed.data[s]
    if (!defs?.length) continue
    const keepIds = defs
      .map((_, i) => i)
      .filter(i => !namesToRemove.has(defs[i][0]))
    if (keepIds.length === defs.length) continue
    const newIdByOldId = new Map(keepIds.map((oldId, newId) => [oldId, newId]))
    updates.push({
      stimulusId: s,
      channelDefs: keepIds.map(i => [...defs[i]]),
      eventBuffers: keepIds.map(i =>
        (ed.events[s]?.[i] ?? []).map(buffer => [...buffer])
      ),
      hiddenChannels: (ed.hiddenChannels?.[s] ?? [])
        .map(id => newIdByOldId.get(id))
        .filter((id): id is number => id !== undefined)
        .sort((a, b) => a - b),
    })
  }
  return updates
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
