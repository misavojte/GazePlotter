import {
  NONE_SELECTION_ID,
  type EventDataUpdate,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
import { INTERVAL_CHANNEL_MARKER } from '../eventIntervals'
import {
  getDefaultEventChannelColor,
  interpretOrdered,
} from '../utils/interpreters'

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

  return interpretOrdered(
    channels,
    meta.eventData.orderVector?.[stimulusId] ?? [],
    getDefaultEventChannelColor
  )
}

/**
 * The event channels a plot shows for a stimulus, in order-vector order. Global
 * channel visibility is retired — a named event SELECTION is the only narrowing.
 *
 * `eventSelectionId` optionally narrows to a named event SELECTION (matched by
 * displayed name — NameSelections are portable across stimuli exactly like AOI
 * selections). The built-in "None" narrows to no channels (events off). Unset
 * / 0 / unknown → no narrowing, same self-healing contract as getAois'
 * aoiSelectionId.
 */
export const getSelectedEventChannels = (
  engine: DataEngine,
  stimulusId: number,
  eventSelectionId?: number
): ExtendedInterpretedDataType[] => {
  if (eventSelectionId === NONE_SELECTION_ID) return []
  const all = getEventChannels(engine, stimulusId)
  if (eventSelectionId == null || eventSelectionId <= 0) return all
  const selection = (engine.metadata?.eventsSelections ?? []).find(
    s => s.id === eventSelectionId
  )
  if (!selection) return all
  const names = new Set(selection.names)
  return all.filter(ch => names.has(ch.displayedName))
}

/**
 * Aggregated view of event channels across ALL stimuli, keyed by original
 * name — the unit channel-level operations act on ("delete 'task'
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
  const reader = engine.getEventReader()
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
      entry.occurrenceCount += reader.getChannelOccurrenceCount(s, c)
      const onset = reader.getChannelFirstOnset(s, c)
      if (onset < entry.firstOnset) entry.firstOnset = onset
    }
  }
  return Array.from(byName, ([name, counts]) => ({ name, ...counts }))
}

/**
 * Per-stimulus replacement payloads (for `updateEventData` commands) that
 * drop every channel whose original name is in `namesToRemove`. Stimuli
 * with no matching channel are omitted.
 */
export const buildEventDataWithoutChannels = (
  engine: DataEngine,
  namesToRemove: ReadonlySet<string>
): EventDataUpdate[] => {
  const meta = engine.metadata
  if (!meta) return []
  const ed = meta.eventData
  const reader = engine.getEventReader()
  const updates: EventDataUpdate[] = []
  for (let s = 0; s < ed.data.length; s++) {
    const defs = ed.data[s]
    if (!defs?.length) continue
    const keepIds = defs
      .map((_, i) => i)
      .filter(i => !namesToRemove.has(defs[i][0]))
    if (keepIds.length === defs.length) continue
    const buffers = reader.getStimulusJson(s)
    updates.push({
      stimulusId: s,
      channelDefs: keepIds.map(i => [...defs[i]]),
      eventBuffers: keepIds.map(i =>
        (buffers[i] ?? []).map(buffer => [...buffer])
      ),
    })
  }
  return updates
}

/**
 * Returns the stride-2 event buffer [start, duration, ...] for a specific
 * channel and participant as a zero-allocation `Float32Array` view into the
 * binary store. Returns null if the channel has no events for this
 * participant. Hot path — read directly, never inside reactive tracking.
 */
export const getEventBuffer = (
  engine: DataEngine,
  stimulusId: number,
  channelId: number,
  participantId: number
): Float32Array | null => {
  const buffer = engine
    .getEventReader()
    .getOccurrences(stimulusId, channelId, participantId)
  return buffer.length === 0 ? null : buffer
}
