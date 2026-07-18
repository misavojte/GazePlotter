import type { BaseInterpretedDataType, NameSelection } from '$lib/data/types'
import type { MergeCard } from './groupedEntityEditor.svelte'
import type { SelectionSessionConfig } from './selectionSession.svelte'
import { selectionChips } from './selectionAdapters'

type Group = MergeCard<BaseInterpretedDataType>

/**
 * The name-keyed membership half of a selection session, shared by the AOI and
 * event-channel modals. Unlike the id-keyed adapter, members are stored BY
 * DISPLAYED NAME, so membership is read through a rename map (open name → the
 * name currently staged in the list). Staged renames are never written into the
 * selections while typing — transient names (backspace-to-empty, collisions
 * mid-word) therefore cannot corrupt membership; the commit resolves once.
 *
 * The reactive plumbing (which editor items feed the map, which stimulus/scope
 * the open names come from) stays in each modal; everything below is pure so it
 * can be unit-tested and shared. See `tests/nameKeyedSelection.test.ts`.
 */

/**
 * Open name → current staged name, applying the identity / ambiguity / drop
 * rules. `pairs` is `[openName, currentName]` for every row in the active list.
 *
 * - identity (`open === current`): no entry; the name is unchanged.
 * - emptied current (mid-typing): dropped, so membership keeps the open name.
 * - one open renamed two ways, OR an open that also appears unchanged (splitting
 *   a saved merge by renaming one member): ambiguous → dropped, membership keeps
 *   the still-live open name.
 * - two different opens → the same current: kept (a merge).
 */
export function buildRenameMap(
  pairs: Iterable<readonly [string | undefined, string | undefined]>
): Map<string, string> {
  const map = new Map<string, string>()
  const drop = new Set<string>()
  // Identity usages count for ambiguity too: splitting a saved merge by
  // renaming ONE member leaves the open name alive on the others, so the rename
  // must NOT capture it (membership keeps the still-existing name).
  const identity = new Set<string>()
  for (const [openRaw, currentRaw] of pairs) {
    const o = (openRaw ?? '').trim()
    const c = (currentRaw ?? '').trim()
    if (!o) continue
    if (o === c) {
      identity.add(o)
      if (map.has(o)) drop.add(o)
      continue
    }
    if (!c) {
      drop.add(o)
      continue
    }
    if (identity.has(o) || (map.has(o) && map.get(o) !== c)) {
      drop.add(o)
      continue
    }
    map.set(o, c)
  }
  for (const o of drop) map.delete(o)
  return map
}

/** Resolve one stored name to its current staged name (trimmed fallback). */
export const resolveName = (
  renameMap: ReadonlyMap<string, string>,
  n: string
): string => {
  const t = (n || '').trim()
  return renameMap.get(t) ?? t
}

/** A group's current (staged) displayed name — its leader's, trimmed. */
const currentName = (g: Group): string =>
  (g.members[0].displayedName || '').trim()

/** The selection's members resolved to current names, empties dropped. */
export const effectiveSet = (
  renameMap: ReadonlyMap<string, string>,
  sel: NameSelection
): Set<string> =>
  new Set(sel.names.map(n => resolveName(renameMap, n)).filter(Boolean))

/**
 * The open names a group contributes to a selection: the members' names at
 * scope entry (portable across renames), falling back to the current name when
 * a member has no open name yet (a row created this session).
 */
const openNamesOf = (
  openNameOf: (id: number) => string | undefined,
  g: Group
): string[] => {
  const names = g.members
    .map(m => (openNameOf(m.id) ?? '').trim())
    .filter(Boolean)
  return names.length > 0 ? [...new Set(names)] : [currentName(g)]
}

/** Groups with an empty displayed name cannot ring or toggle while editing. */
export const nameKeyedInertIds = (groups: Group[]): Set<number> =>
  new Set(groups.filter(g => currentName(g) === '').map(g => g.id))

/** Deep copy for seeding the session from engine state. */
export const cloneNameSelections = <T extends NameSelection>(list: T[]): T[] =>
  list.map(s => ({ ...s, names: [...s.names] }))

/** Order-insensitive signature for no-op-Apply detection. */
export const canonicalNameSelections = (list: NameSelection[]): string =>
  JSON.stringify(
    list
      .map(s => ({ id: s.id, name: s.name.trim(), names: [...s.names].sort() }))
      .sort((a, b) => a.id - b.id)
  )

/**
 * Commit shape: names resolved through the rename map (deduped, sorted) and a
 * trimmed fallback name. No pruning of unmatched names — a name unmatched in
 * the active scope may match other stimuli or return, so the resolver ignores
 * unknown names and counts stay domain-honest.
 */
export const commitNameSelections = (
  renameMap: ReadonlyMap<string, string>,
  list: NameSelection[]
): NameSelection[] =>
  list.map(s => ({
    id: s.id,
    name: s.name.trim() || `Selection ${s.id}`,
    names: [...new Set(s.names.map(n => resolveName(renameMap, n)).filter(Boolean))].sort(),
  }))

/**
 * Tray chips for a name-keyed modal (AOI / event channels). Unlike the id-keyed
 * default, the count is the selection's members that exist ANYWHERE in the
 * dataset (`domainNames`, portable across stimuli), and a "N elsewhere" hint
 * shows how many of a chip's members lie outside the current scope while it is
 * being edited.
 */
export function nameKeyedChips(
  session: {
    selections: NameSelection[]
    editingId: number | null
    memberGroupIds(sel: NameSelection): Set<number>
    foldFlags(sel: NameSelection): { addable: boolean; removable: boolean }
  },
  renameMap: ReadonlyMap<string, string>,
  domainNames: ReadonlySet<string>,
  noun: string
) {
  return selectionChips(session, noun, {
    count: s => [...effectiveSet(renameMap, s)].filter(n => domainNames.has(n)).length,
    title: c => `${c} ${noun} across all stimuli`,
    hint: (s, count) => {
      if (s.id !== session.editingId) return undefined
      const elsewhere = count - session.memberGroupIds(s).size
      return elsewhere > 0 ? `${elsewhere} elsewhere` : undefined
    },
  })
}

/**
 * The `isMember` / `withMembers` / `create` config for `createSelectionSession`,
 * parameterized by the two name-space accessors the modal supplies: a getter for
 * the current rename map and `openNameOf(id)` for the active scope's open names.
 */
export function nameKeyedMembership(deps: {
  renameMap: () => ReadonlyMap<string, string>
  openNameOf: (id: number) => string | undefined
}): Pick<
  SelectionSessionConfig<NameSelection>,
  'isMember' | 'withMembers' | 'create'
> {
  const opensOf = (g: Group) => openNamesOf(deps.openNameOf, g)

  // `isMember` runs per group per reactive invalidation and rebuilds the
  // resolved-name set each time. Memoize it on (rename map × selection): both
  // are replaced wholesale on any change (a fresh Map from `buildRenameMap`, a
  // fresh selection object from the session), so the nested WeakMaps
  // self-invalidate and never go stale.
  const _effCache = new WeakMap<
    ReadonlyMap<string, string>,
    WeakMap<NameSelection, Set<string>>
  >()
  const eff = (sel: NameSelection): Set<string> => {
    const map = deps.renameMap()
    let byMap = _effCache.get(map)
    if (!byMap) {
      byMap = new WeakMap()
      _effCache.set(map, byMap)
    }
    let set = byMap.get(sel)
    if (!set) {
      set = effectiveSet(map, sel)
      byMap.set(sel, set)
    }
    return set
  }

  return {
    isMember: (sel, g) => {
      const cn = currentName(g)
      return cn !== '' && eff(sel).has(cn)
    },
    withMembers: (sel, gs, on) => {
      if (on) {
        return {
          ...sel,
          names: [...new Set([...sel.names, ...gs.flatMap(opensOf)])],
        }
      }
      const off = new Set(gs.map(currentName).filter(Boolean))
      const map = deps.renameMap()
      return { ...sel, names: sel.names.filter(n => !off.has(resolveName(map, n))) }
    },
    create: (id, seed) => ({
      id,
      name: `Selection ${id}`,
      names: [...new Set(seed.flatMap(opensOf))],
    }),
  }
}
