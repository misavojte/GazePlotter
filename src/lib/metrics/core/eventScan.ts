import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { EVENT_STRIDE } from '$lib/data/binary'
import { getEventChannels } from '$lib/data/engine'
import {
  groupByDisplayedName,
  type GroupedByDisplayedName,
} from '$lib/data/engine/utils/grouping'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { getRecipe } from './defineMetric'

/**
 * THE canonical event axis of one stimulus: one entry per displayed-name
 * MERGE of its channel table, in orderVector order. The ORDER CONTRACT
 * between event-vector recipes, whose finalize vector is indexed by it, the
 * `pick-event` projection, which resolves names against it, and every
 * consumer labeling per-channel values. Per stimulus, unlike categoryGroups.
 */
export function eventGroups(
  engine: DataEngine,
  stimulusId: number
): GroupedByDisplayedName<ExtendedInterpretedDataType>[] {
  return groupByDisplayedName(getEventChannels(engine, stimulusId))
}

/** The axis's display names, in `eventGroups` order. */
export function eventGroupNames(
  engine: DataEngine,
  stimulusId: number
): string[] {
  return eventGroups(engine, stimulusId).map(g => g.displayedName)
}

/**
 * Workspace-wide union of axis names, first occurrence wins (stimulus id
 * order). Instances are workspace-global while channels are per-stimulus, so
 * the pick-event picker offers this.
 */
export function eventGroupNamesUnion(engine: DataEngine): string[] {
  const stimuliCount = engine.metadata?.eventData.data.length ?? 0
  const seen = new Set<string>()
  const names: string[] = []
  for (let s = 0; s < stimuliCount; s++) {
    for (const name of eventGroupNames(engine, s)) {
      if (seen.has(name)) continue
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

/**
 * Merged occurrence stream of one (stimulus, participant), sorted by start.
 * Always typed arrays, so the scan loop stays monomorphic.
 */
export interface EventScanStream {
  starts: Float64Array
  durations: Float64Array
  /** Per-occurrence slot on the `eventGroups` axis. */
  slots: Int16Array
  count: number
  /** `eventGroups(engine, stimulusId).length`. */
  slotCount: number
}

/**
 * Rebuilt per scan, like the category walk in `resolveScanIndex`: runs on
 * result-cache misses only, so no scan-index cache is warranted.
 */
export function resolveEventScan(
  engine: DataEngine,
  stimulusId: number,
  participantId: number
): EventScanStream {
  const groups = eventGroups(engine, stimulusId)
  const reader = engine.getEventReader()

  let total = 0
  for (const g of groups) {
    for (const id of g.memberIds) {
      total += reader.getOccurrences(stimulusId, id, participantId).length
    }
  }
  const count = total / EVENT_STRIDE

  const starts = new Float64Array(count)
  const durations = new Float64Array(count)
  const slots = new Int16Array(count)
  let k = 0
  for (let s = 0; s < groups.length; s++) {
    for (const id of groups[s].memberIds) {
      const buf = reader.getOccurrences(stimulusId, id, participantId)
      for (let i = 0; i < buf.length; i += EVENT_STRIDE) {
        starts[k] = buf[i]
        durations[k] = buf[i + 1]
        slots[k] = s
        k++
      }
    }
  }

  // Indirect stable sort by start (ties keep axis order), permuted into fresh
  // arrays — file buffers carry no cross-channel order guarantee.
  const order = Array.from({ length: count }, (_, i) => i)
  order.sort((a, b) => starts[a] - starts[b])
  const outStarts = new Float64Array(count)
  const outDurations = new Float64Array(count)
  const outSlots = new Int16Array(count)
  for (let i = 0; i < count; i++) {
    const j = order[i]
    outStarts[i] = starts[j]
    outDurations[i] = durations[j]
    outSlots[i] = slots[j]
  }

  return {
    starts: outStarts,
    durations: outDurations,
    slots: outSlots,
    count,
    slotCount: groups.length,
  }
}

/**
 * THE half-open + instant membership rule: an interval overlaps `[lo, hi)`
 * by positive intersection; an instant `[t, t)` lies where `t` lies, so it
 * lands in exactly one window of a non-overlapping tiling.
 */
export function occurrenceOverlapsRange(
  start: number,
  end: number,
  lo: number,
  hi: number
): boolean {
  return end > start ? start < hi && end > lo : start >= lo && start < hi
}

/**
 * Event results depend on state the reader-keyed bucket cannot see: the
 * occurrence buffers (`eventVersion` bumps on load, upload, create-intervals,
 * deletion — all via `updateEventDataBatch`) and the per-stimulus channel
 * table (rename, MERGE fold, reorder edit metadata and bump nothing). Both
 * ride the key; neither subsumes the other. Empty for every other recipe, so
 * event edits never evict fixation-metric entries. Reading `eventVersion`
 * ($state) here also hands reactive consumers their dependency.
 */
export function eventCacheToken(
  engine: DataEngine,
  baseId: string,
  stimulusId: number
): string {
  if (getRecipe(baseId)?.scanSource !== 'events') return ''
  // '\x1f' separators (the slotSignatures convention) — displayed names are
  // free text, so a typable delimiter could make two tables collide.
  return `e${engine.eventVersion}|${getEventChannels(engine, stimulusId)
    .map(c => `${c.id}\x1f${c.displayedName}`)
    .join('\x1f')}|`
}
