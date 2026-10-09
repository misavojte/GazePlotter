import type { ExtendedInterpretedDataType } from '$lib/data/types'

/**
 * The AOI modal's "All stimuli" scope, as pure functions: build the
 * cross-stimulus union the list edits, decide which FIELDS the user edited,
 * and plan the per-stimulus updates one atomic `updateAois` command carries.
 * No engine, no runes — the modal supplies `perStimulus` (every visible
 * stimulus's current AOI list, display order) and the editor's state.
 * See `tests/aoiAllStimuliPlan.test.ts`.
 *
 * Semantics: rows are keyed by ORIGINAL name. A field (displayed name or
 * color) counts as edited when the user touched it or its value differs from
 * the first-seen value; an edited field is applied to every stimulus
 * containing that original name, unifying divergent per-stimulus values.
 * A field the user left alone keeps each stimulus's own value verbatim.
 * Order reconciliation is opt-in by gesture (union rows rearranged).
 */

export interface StimulusAois {
  stimulusId: number
  aois: ExtendedInterpretedDataType[]
}

export interface UnionRow extends ExtendedInterpretedDataType {
  /** `n/total` stimuli containing the original name, `*` when its name or
      color currently differs between stimuli. */
  stimuliLabel: string
}

export interface UnionInit {
  displayedName: string
  color: string
}

export interface AllStimuliUnion {
  /** One synthetic row per original name: ids 0..n-1 in first-seen order,
      first-seen displayed name and color. */
  rows: UnionRow[]
  /** Original name → the first-seen values the rows opened with. */
  init: Map<string, UnionInit>
  /** Original name → every distinct trimmed non-empty displayed name it has
      across stimuli (the open-name space selections may reference). */
  openNames: Map<string, Set<string>>
}

/** Union row ids the user edited, per field (the editor's bookkeeping). */
export interface Touched {
  name: ReadonlySet<number>
  color: ReadonlySet<number>
}

/** Only the EDITED fields are present. */
export interface FieldEdits {
  displayedName?: string
  color?: string
}

const trimName = (s: string | null | undefined): string => (s ?? '').trim()

/** Hex case is a serialization detail, not a different color. */
const sameColor = (a: string, b: string): boolean =>
  trimName(a).toLowerCase() === trimName(b).toLowerCase()

export function buildAllStimuliUnion(
  perStimulus: StimulusAois[]
): AllStimuliUnion {
  const rows: UnionRow[] = []
  const init = new Map<string, UnionInit>()
  const openNames = new Map<string, Set<string>>()
  const counts = new Map<string, number>()
  const varies = new Set<string>()

  for (const { aois } of perStimulus) {
    const seen = new Set<string>()
    for (const a of aois) {
      const first = init.get(a.originalName)
      if (!first) {
        init.set(a.originalName, {
          displayedName: a.displayedName,
          color: a.color,
        })
        rows.push({
          id: rows.length,
          originalName: a.originalName,
          displayedName: a.displayedName,
          color: a.color,
          stimuliLabel: '',
        })
      } else if (
        trimName(a.displayedName) !== trimName(first.displayedName) ||
        !sameColor(a.color, first.color)
      ) {
        varies.add(a.originalName)
      }

      const name = trimName(a.displayedName)
      if (name) {
        let names = openNames.get(a.originalName)
        if (!names) openNames.set(a.originalName, (names = new Set()))
        names.add(name)
      }
      if (!seen.has(a.originalName)) {
        seen.add(a.originalName)
        counts.set(a.originalName, (counts.get(a.originalName) ?? 0) + 1)
      }
    }
  }

  const total = perStimulus.length
  for (const row of rows) {
    const n = counts.get(row.originalName) ?? 0
    row.stimuliLabel = `${n}/${total}${varies.has(row.originalName) ? '*' : ''}`
  }
  return { rows, init, openNames }
}

/**
 * Original name → edited fields. `cleaned` is the editor's trimmed row list
 * (synthetic union ids); a field is edited iff `touched` holds the row id for
 * it OR its value differs from `init` (names trimmed both sides, colors
 * compared case-insensitively). Re-picking the shown value therefore IS an
 * edit — the only way to unify a divergent (`*`) row to what it shows.
 */
export function resolveAllStimuliEdits(
  cleaned: ExtendedInterpretedDataType[],
  init: ReadonlyMap<string, UnionInit>,
  touched: Touched
): Map<string, FieldEdits> {
  const edits = new Map<string, FieldEdits>()
  for (const row of cleaned) {
    const first = init.get(row.originalName)
    if (!first) continue
    const e: FieldEdits = {}
    if (
      touched.name.has(row.id) ||
      trimName(row.displayedName) !== trimName(first.displayedName)
    ) {
      e.displayedName = trimName(row.displayedName)
    }
    if (touched.color.has(row.id) || !sameColor(row.color, first.color)) {
      e.color = row.color
    }
    if (e.displayedName !== undefined || e.color !== undefined) {
      edits.set(row.originalName, e)
    }
  }
  return edits
}

/**
 * The full per-stimulus AOI lists for every stimulus that changes — by value
 * (an edited field applied to every row with that original name, other fields
 * copied verbatim) or by position (when the union rows were rearranged, every
 * stimulus adopts the shared order; a stable sort keeps rows sharing an
 * original name in their in-stimulus order). Each stimulus appears at most
 * once; an empty result means nothing to apply.
 */
export function planAllStimuliUpdates(
  perStimulus: StimulusAois[],
  cleaned: ExtendedInterpretedDataType[],
  edits: ReadonlyMap<string, FieldEdits>
): StimulusAois[] {
  // Synthetic union ids are 0..n-1 in first-seen order, so any deviation from
  // the identity sequence means the user reordered (drag or sort).
  const orderChanged = cleaned.some((it, idx) => it.id !== idx)
  if (edits.size === 0 && !orderChanged) return []

  const rank = new Map(
    cleaned.map((it, idx) => [it.originalName, idx] as const)
  )
  const unranked = cleaned.length

  const updates: StimulusAois[] = []
  for (const { stimulusId, aois } of perStimulus) {
    let changed = false
    let next: ExtendedInterpretedDataType[] = aois.map(a => {
      const e = edits.get(a.originalName)
      const displayedName = e?.displayedName ?? a.displayedName
      const color = e?.color ?? a.color
      if (displayedName !== a.displayedName || color !== a.color) changed = true
      return { id: a.id, originalName: a.originalName, displayedName, color }
    })
    if (orderChanged) {
      const sorted = [...next].sort(
        (x, y) =>
          (rank.get(x.originalName) ?? unranked) -
          (rank.get(y.originalName) ?? unranked)
      )
      if (sorted.some((it, i) => it.id !== next[i].id)) changed = true
      next = sorted
    }
    if (changed) updates.push({ stimulusId, aois: next })
  }
  return updates
}

/**
 * `[openName, currentName]` pairs for `buildRenameMap` in the all-stimuli
 * scope: for every original name and every displayed name it has anywhere,
 * `[name, newName]` when its displayed name is edited, else the identity
 * `[name, name]`. The identity pairs are load-bearing — they register names
 * still live on an unedited original, so `buildRenameMap`'s ambiguity rule
 * drops a rename that would otherwise capture them and selections keep
 * matching those rows.
 */
export function allStimuliRenamePairs(
  union: AllStimuliUnion,
  edits: ReadonlyMap<string, FieldEdits>
): [string, string][] {
  const pairs: [string, string][] = []
  for (const [originalName, names] of union.openNames) {
    const renamed = edits.get(originalName)?.displayedName
    for (const name of names) pairs.push([name, renamed ?? name])
  }
  return pairs
}
