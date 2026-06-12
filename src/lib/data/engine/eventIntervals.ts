import type { DataEngine } from './dataEngine.svelte'
import { getParticipant, getStimulus } from './selectors/entitySelectors'

/**
 * Derived interval channels — the event-library operation that constructs
 * a NEW duration channel from two existing channels (start markers + end
 * markers). Originals are immutable: parsers import events verbatim
 * (discrete, or with the source format's native duration) and derivation
 * only APPENDS; the sources stay untouched and visible. Derived defs carry
 * `INTERVAL_CHANNEL_MARKER` at index 3, so the Create-intervals step can
 * list them for reversal. Reversal is structural — delete the derived
 * channel — and never depends on the undo stack.
 *
 * Interval boundaries are event ONSETS (the stride-2 start times), so any
 * channel can serve as a boundary, including one that already carries
 * durations.
 *
 * Pairing rule: strict alternation per (stimulus, participant) — a start
 * opens an interval, the next end closes it. `pairIntervalTimes` reports
 * everything else as errors while still pairing what alternates cleanly
 * (keep-first), so its `pairs` output doubles as the lenient
 * "create valid intervals only" result. The UI decides strict vs lenient
 * by which drafts it builds; this module is policy-free.
 *
 * Everything here resolves into plain `updateEventData` payloads — the
 * command/undo layer only ever sees "events changed".
 */

export type PairingErrorKind = 'double-start' | 'orphan-end' | 'unclosed-start'

export interface PairingError {
  kind: PairingErrorKind
  /** Time of the offending occurrence, in the unit of the inputs. */
  time: number
}

export interface PairingResult {
  /** [startIndex, endIndex] into the two input arrays. */
  pairs: [number, number][]
  errors: PairingError[]
}

/**
 * Pair sorted start/end time streams by strict alternation. A start while
 * one is open is a 'double-start' (keep-first: the earlier start stays
 * open, the offender is reported once and never opened); an end with none
 * open is an 'orphan-end'; an open start at end-of-stream is an
 * 'unclosed-start'.
 *
 * Tie-break at equal times: with an interval open the end processes first
 * (back-to-back intervals, not a spurious double-start); with none open
 * the start processes first (a zero-length interval, not an orphan end).
 * Both are legal and produce no errors.
 */
export function pairIntervalTimes(
  startTimes: number[],
  endTimes: number[]
): PairingResult {
  const pairs: [number, number][] = []
  const errors: PairingError[] = []
  let openStart: number | null = null
  let si = 0
  let ei = 0
  while (si < startTimes.length || ei < endTimes.length) {
    const s = si < startTimes.length ? startTimes[si] : Infinity
    const e = ei < endTimes.length ? endTimes[ei] : Infinity
    const takeEnd = e < s || (e === s && openStart !== null)
    if (takeEnd) {
      if (openStart === null) {
        errors.push({ kind: 'orphan-end', time: e })
      } else {
        pairs.push([openStart, ei])
        openStart = null
      }
      ei++
    } else {
      if (openStart !== null) {
        errors.push({ kind: 'double-start', time: s })
      } else {
        openStart = si
      }
      si++
    }
  }
  if (openStart !== null) {
    errors.push({ kind: 'unclosed-start', time: startTimes[openStart] })
  }
  return { pairs, errors }
}

/* ── Suffix-pattern pair proposals ───────────────────────────────── */

export interface SuffixPair {
  startSuffix: string
  endSuffix: string
}

/**
 * Guess the start/end naming convention from the channel names (e.g.
 * `task-0`/`task-1` → `-0`/`-1`, `music start`/`music end` →
 * ` start`/` end`). Pairwise longest-common-prefix voting: every ordered
 * name pair with a non-empty shared stem votes for its suffix pair; the
 * winner needs at least two distinct stems (one match is as likely
 * coincidence as convention). Ties go to the longer combined suffix.
 *
 * Count and weight can never separate a direction from its mirror
 * (`-0`/`-1` and `-1`/`-0` collect the same stems), so the DIRECTION is
 * resolved from `firstOnsetByName` when given: per stem, the start
 * marker's first occurrence should precede the end marker's; majority
 * wins. Without onset data the direction falls back to name enumeration
 * order. Only ever used to PREFILL the pattern inputs — a wrong guess
 * costs the user one glance at the proposal preview.
 */
export function detectSuffixPair(
  names: string[],
  firstOnsetByName?: ReadonlyMap<string, number>
): SuffixPair | null {
  const isSeparator = (char: string) => /[\s\-_./]/.test(char)
  const votes = new Map<string, { pair: SuffixPair; stems: Set<string> }>()
  for (const a of names) {
    for (const b of names) {
      if (a === b) continue
      let common = 0
      const max = Math.min(a.length, b.length)
      while (common < max && a[common] === b[common]) common++
      // Pull trailing separators out of the stem into the suffixes, so
      // `task-0`/`task-1` detects as `-0`/`-1` (stem `task`), not `0`/`1`.
      while (common > 0 && isSeparator(a[common - 1])) common--
      const stem = a.slice(0, common)
      const startSuffix = a.slice(common)
      const endSuffix = b.slice(common)
      if (!stem.trim() || !startSuffix || !endSuffix) continue
      const key = `${startSuffix}\u0000${endSuffix}`
      let entry = votes.get(key)
      if (!entry) {
        entry = { pair: { startSuffix, endSuffix }, stems: new Set() }
        votes.set(key, entry)
      }
      entry.stems.add(stem)
    }
  }
  let best: {
    pair: SuffixPair
    stems: Set<string>
    count: number
    weight: number
  } | null = null
  for (const { pair, stems } of votes.values()) {
    const count = stems.size
    if (count < 2) continue
    const weight = pair.startSuffix.length + pair.endSuffix.length
    if (!best || count > best.count || (count === best.count && weight > best.weight)) {
      best = { pair, stems, count, weight }
    }
  }
  if (!best) return null
  if (firstOnsetByName) {
    const { startSuffix, endSuffix } = best.pair
    const mirror = votes.get(`${endSuffix}\u0000${startSuffix}`)
    if (mirror) {
      let forward = 0
      let reversed = 0
      for (const stem of best.stems) {
        const start = firstOnsetByName.get(stem + startSuffix)
        const end = firstOnsetByName.get(stem + endSuffix)
        if (start === undefined || end === undefined) continue
        if (start < end) forward++
        else if (end < start) reversed++
      }
      if (reversed > forward) return mirror.pair
    }
  }
  return best.pair
}

/**
 * Marker stored at index 3 of a channel def (`[original, displayed, color,
 * marker]`) identifying a derived interval channel. It rides along the
 * def through commands, undo, and workspace serialization; imported
 * channels simply have no fourth element.
 */
export const INTERVAL_CHANNEL_MARKER = 'interval'

/** A proposed/declared interval channel: `name` from `startName`→`endName`. */
export interface IntervalDraft {
  name: string
  startName: string
  endName: string
}

/**
 * Pair proposals for a suffix convention: one draft per stem where BOTH
 * `stem+startSuffix` and `stem+endSuffix` exist as channels, named by the
 * trimmed stem. Names matching exactly one suffix are reported in
 * `oneSided` so the UI can surface them — never silently dropped.
 */
export function proposePairsBySuffix(
  names: string[],
  startSuffix: string,
  endSuffix: string
): { proposals: IntervalDraft[]; oneSided: string[] } {
  if (!startSuffix || !endSuffix || startSuffix === endSuffix) {
    return { proposals: [], oneSided: [] }
  }
  const nameSet = new Set(names)
  const proposals: IntervalDraft[] = []
  const oneSided: string[] = []
  for (const name of names) {
    if (name.endsWith(startSuffix)) {
      const stem = name.slice(0, name.length - startSuffix.length)
      if (!stem.trim()) continue
      if (nameSet.has(stem + endSuffix)) {
        proposals.push({
          name: stem.trim(),
          startName: name,
          endName: stem + endSuffix,
        })
      } else {
        oneSided.push(name)
      }
    } else if (name.endsWith(endSuffix)) {
      const stem = name.slice(0, name.length - endSuffix.length)
      if (!stem.trim()) continue
      if (!nameSet.has(stem + startSuffix)) oneSided.push(name)
    }
  }
  return { proposals, oneSided }
}

/* ── Draft preview (validation) ──────────────────────────────────── */

export interface IntervalPairError {
  startChannel: string
  endChannel: string
  stimulus: string
  participant: string
  kind: PairingErrorKind
  timeMs: number
}

export interface IntervalDraftPreview {
  draft: IntervalDraft
  /** Intervals that pair cleanly across all stimuli and participants. */
  pairedCount: number
  /** Offending occurrences (= errors) that lenient mode would skip. */
  skippedCount: number
  errors: IntervalPairError[]
  /** Set when the draft cannot be built regardless of pairing. */
  nameError?: string
}

/**
 * Validate drafts against the dataset: pair every (stimulus, participant)
 * occurrence stream and flag name problems (empty, collision with an
 * existing channel, duplicate among the drafts). Pure read — the UI calls
 * this on every draft change.
 */
export const previewIntervalDrafts = (
  engine: DataEngine,
  drafts: IntervalDraft[]
): IntervalDraftPreview[] => {
  const meta = engine.metadata
  if (!meta) return []
  const ed = meta.eventData

  const existingNames = new Set<string>()
  for (const defs of ed.data) {
    for (const def of defs ?? []) existingNames.add(def[0])
  }
  const draftNameCounts = new Map<string, number>()
  for (const draft of drafts) {
    draftNameCounts.set(draft.name, (draftNameCounts.get(draft.name) ?? 0) + 1)
  }

  return drafts.map(draft => {
    let nameError: string | undefined
    if (!draft.name.trim()) {
      nameError = 'Name the new channel'
    } else if (existingNames.has(draft.name)) {
      nameError = `A channel named '${draft.name}' already exists`
    } else if ((draftNameCounts.get(draft.name) ?? 0) > 1) {
      nameError = `'${draft.name}' is used by another pair`
    }

    let pairedCount = 0
    const errors: IntervalPairError[] = []
    forEachPairing(engine, draft, (s, p, result) => {
      pairedCount += result.pairs.length
      for (const error of result.errors) {
        errors.push({
          startChannel: draft.startName,
          endChannel: draft.endName,
          stimulus: getStimulus(engine, s).displayedName,
          participant: getParticipant(engine, p).displayedName,
          kind: error.kind,
          timeMs: error.time,
        })
      }
    })

    return {
      draft,
      pairedCount,
      skippedCount: errors.length,
      errors,
      ...(nameError !== undefined ? { nameError } : {}),
    }
  })
}

/* ── Payload building ────────────────────────────────────────────── */

export interface IntervalUpdate {
  stimulusId: number
  channelDefs: string[][]
  eventBuffers: number[][][]
  hiddenChannels: number[]
}

/**
 * Per-stimulus replacement payloads (for `updateEventData` commands) that
 * APPEND one derived channel per draft to every stimulus where the draft's
 * start or end channel exists. All existing channels are kept, emitted in
 * the stimulus's current display order (the engine resets `orderVector`
 * to identity on replacement, so order survives by construction);
 * `hiddenChannels` carries the old hidden set remapped to the new ids.
 * Derived defs are tagged with `INTERVAL_CHANNEL_MARKER`.
 *
 * Pairing is keep-first (lenient by construction) — pass only clean drafts
 * for strict semantics. Throws on drafts the preview would have flagged
 * (empty/duplicate names): a programming error, not a data condition.
 */
export const buildEventDataWithIntervalChannels = (
  engine: DataEngine,
  drafts: IntervalDraft[]
): IntervalUpdate[] => {
  const meta = engine.metadata
  if (!meta) return []

  const seenNames = new Set<string>()
  for (const draft of drafts) {
    if (!draft.name.trim() || seenNames.has(draft.name)) {
      throw new Error(`Invalid interval channel draft name: '${draft.name}'`)
    }
    seenNames.add(draft.name)
  }

  const ed = meta.eventData
  const updates: IntervalUpdate[] = []

  for (let s = 0; s < ed.data.length; s++) {
    const defs = ed.data[s]
    if (!defs?.length) continue
    const idByName = new Map(defs.map((def, id) => [def[0], id] as const))
    const buffers = ed.events[s] ?? []
    const participantCount = buffers[0]?.length ?? 0

    const appendedDefs: string[][] = []
    const appendedBuffers: number[][][] = []

    for (const draft of drafts) {
      const startId = idByName.get(draft.startName)
      const endId = idByName.get(draft.endName)
      if (startId === undefined && endId === undefined) continue

      const startBuffers = startId !== undefined ? (buffers[startId] ?? []) : []
      const endBuffers = endId !== undefined ? (buffers[endId] ?? []) : []
      const slots = Math.max(
        startBuffers.length,
        endBuffers.length,
        participantCount
      )
      const merged: number[][] = []
      for (let p = 0; p < slots; p++) {
        const starts = strideStarts(startBuffers[p]).sort((a, b) => a - b)
        const ends = strideStarts(endBuffers[p]).sort((a, b) => a - b)
        const result = pairIntervalTimes(starts, ends)
        const buffer: number[] = []
        for (const [si, ei] of result.pairs) {
          buffer.push(starts[si], ends[ei] - starts[si])
        }
        merged.push(buffer)
      }

      const color =
        (startId !== undefined ? defs[startId][2] : undefined) ??
        (endId !== undefined ? defs[endId][2] : undefined) ??
        '#888888'
      appendedDefs.push([draft.name, draft.name, color, INTERVAL_CHANNEL_MARKER])
      appendedBuffers.push(merged)
    }

    if (appendedDefs.length === 0) continue

    const order = ed.orderVector?.[s]
    const orderedIds =
      order && order.length > 0
        ? order
        : Array.from({ length: defs.length }, (_, i) => i)
    const newIdByOldId = new Map(orderedIds.map((id, index) => [id, index]))

    const hidden = new Set(
      (ed.hiddenChannels?.[s] ?? [])
        .map(id => newIdByOldId.get(id))
        .filter((id): id is number => id !== undefined)
    )

    updates.push({
      stimulusId: s,
      channelDefs: [
        ...orderedIds.map(id => [...defs[id]]),
        ...appendedDefs,
      ],
      eventBuffers: [
        ...orderedIds.map(id => (buffers[id] ?? []).map(buffer => [...buffer])),
        ...appendedBuffers,
      ],
      hiddenChannels: [...hidden].sort((a, b) => a - b),
    })
  }

  return updates
}

/* ── Internals ───────────────────────────────────────────────────── */

/** Run keep-first pairing for one draft on every (stimulus, participant). */
const forEachPairing = (
  engine: DataEngine,
  draft: IntervalDraft,
  visit: (stimulusId: number, participantId: number, result: PairingResult) => void
): void => {
  const ed = engine.metadata!.eventData
  for (let s = 0; s < ed.data.length; s++) {
    const defs = ed.data[s]
    if (!defs?.length) continue
    const idByName = new Map(defs.map((def, id) => [def[0], id] as const))
    const startId = idByName.get(draft.startName)
    const endId = idByName.get(draft.endName)
    if (startId === undefined && endId === undefined) continue

    const buffers = ed.events[s] ?? []
    const startBuffers = startId !== undefined ? (buffers[startId] ?? []) : []
    const endBuffers = endId !== undefined ? (buffers[endId] ?? []) : []
    const slots = Math.max(startBuffers.length, endBuffers.length)
    for (let p = 0; p < slots; p++) {
      const starts = strideStarts(startBuffers[p]).sort((a, b) => a - b)
      const ends = strideStarts(endBuffers[p]).sort((a, b) => a - b)
      if (starts.length === 0 && ends.length === 0) continue
      visit(s, p, pairIntervalTimes(starts, ends))
    }
  }
}

/** Even-index time points of a stride-2 [start, duration, …] buffer. */
const strideStarts = (buffer: number[] | undefined): number[] => {
  if (!buffer || buffer.length === 0) return []
  const out: number[] = []
  for (let i = 0; i + 1 < buffer.length; i += 2) out.push(buffer[i])
  return out
}
