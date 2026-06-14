/**
 * Strict-alternation interval pairing — the shared primitive for turning a
 * stream of start markers and end markers into closed [start, end] intervals.
 *
 * Pure and dependency-free so both layers can use it without crossing the
 * ingest↔engine boundary: the event library derives interval CHANNELS from it
 * (`engine/eventIntervals.ts`), and the Tobii importer validates interval
 * STIMULUS markers with it (`ingest/.../TobiiRowParser.ts`). Keeping one
 * implementation means both report the same three malformed-sequence kinds.
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

/** Human-readable phrasing of a pairing error, shared by every reporter. */
export const describePairingError = (kind: PairingErrorKind): string => {
  switch (kind) {
    case 'double-start':
      return 'a new start occurred while one was still open'
    case 'orphan-end':
      return 'an end occurred with no open start'
    case 'unclosed-start':
      return 'started but never ended'
  }
}
