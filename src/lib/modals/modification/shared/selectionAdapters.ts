import type { BaseInterpretedDataType } from '$lib/data/types'
import type { MergeCard } from './groupedEntityEditor.svelte'
import type {
  SelectionLike,
  SelectionSessionConfig,
} from './selectionSession.svelte'

type Group = MergeCard<BaseInterpretedDataType>

/** Every member id contributed by `groups` (a merged card = all its ids). */
const memberIdsOf = (groups: Group[]): number[] =>
  groups.flatMap(g => g.members.map(m => m.id))

/**
 * The id-keyed membership half of a selection session, shared by the
 * participant / stimulus / eye-movement-type modals: ids are stable across
 * renames so membership needs no rename map; toggling a merged card toggles
 * ALL its member ids. `field` names where the ids live on the selection
 * (`memberIds`, `participantsIds`).
 */
export function idKeyedSelection<
  K extends string,
  TSel extends SelectionLike & Record<K, number[]>,
>(field: K) {
  const idsOf = (sel: TSel): number[] => sel[field]
  const withIds = (sel: TSel, ids: number[]): TSel =>
    ({ ...sel, [field]: ids }) as TSel

  // Membership is tested per group per reactive invalidation, so a linear
  // `ids.includes` scans O(members × ids) every time. Cache one `Set` per
  // selection OBJECT: edits replace the object wholesale (never mutate in
  // place — see the session's `updateSelection`), so the WeakMap entry dies
  // with the stale selection and never goes out of sync.
  const _idSets = new WeakMap<object, Set<number>>()
  const idSet = (sel: TSel): Set<number> => {
    let s = _idSets.get(sel)
    if (!s) {
      s = new Set(idsOf(sel))
      _idSets.set(sel, s)
    }
    return s
  }

  const membership: Pick<
    SelectionSessionConfig<TSel>,
    'isMember' | 'withMembers' | 'create'
  > = {
    isMember: (sel, g) => {
      const set = idSet(sel)
      return g.members.some(m => set.has(m.id))
    },
    withMembers: (sel, gs, on) => {
      const ids = memberIdsOf(gs)
      return withIds(
        sel,
        on
          ? [...new Set([...idsOf(sel), ...ids])]
          : idsOf(sel).filter(id => !ids.includes(id))
      )
    },
    // The computed-key literal can't be typed as the generic TSel directly;
    // it is exactly { id, name, [field] }, which every id-keyed TSel is.
    create: (id, seed) =>
      ({
        id,
        name: `Selection ${id}`,
        [field]: [...new Set(memberIdsOf(seed))],
      }) as unknown as TSel,
  }

  /** Deep copy for seeding the session from engine state. */
  const clone = (list: TSel[]): TSel[] =>
    list.map(s => withIds({ ...s }, [...idsOf(s)]))

  /** Order-insensitive signature for no-op-Apply detection. */
  const canonical = (list: TSel[]): string =>
    JSON.stringify(
      list
        .map(s => ({
          id: s.id,
          name: s.name.trim(),
          ids: [...idsOf(s)].sort((a, b) => a - b),
        }))
        .sort((a, b) => a.id - b.id)
    )

  // A merged card rings as one entity, so committed membership must match:
  // holding ANY member id of a merged group means holding ALL of them
  // (otherwise a selection storing only an absorbed id silently empties).
  const mergeUnion = (ids: number[], groups: Group[]): number[] => {
    const set = new Set(ids)
    for (const g of groups) {
      if (g.members.length > 1 && g.members.some(m => set.has(m.id))) {
        for (const m of g.members) set.add(m.id)
      }
    }
    return [...set].sort((a, b) => a - b)
  }

  /** Commit shape: trimmed fallback name + merge-complete membership. */
  const commit = (selections: TSel[], groups: Group[]): TSel[] =>
    selections.map(s =>
      withIds(
        { ...s, name: s.name.trim() || `Selection ${s.id}` },
        mergeUnion(idsOf(s), groups)
      )
    )

  return { membership, clone, canonical, commit }
}

/**
 * The tray's chip rows: one per saved selection. The id-keyed default counts
 * the selection's currently-visible list groups. The name-keyed modals (AOI /
 * event channels) count DOMAIN names across all stimuli instead, and layer a
 * "N elsewhere" hint, so they pass `count` / `title` / `hint` overrides rather
 * than forking the helper.
 */
export const selectionChips = <TSel extends SelectionLike>(
  session: {
    selections: TSel[]
    memberGroupIds(sel: TSel): Set<number>
    foldFlags(sel: TSel): { addable: boolean; removable: boolean }
  },
  noun: string,
  opts?: {
    count?: (sel: TSel) => number
    title?: (count: number) => string
    hint?: (sel: TSel, count: number) => string | undefined
  }
) =>
  session.selections.map(s => {
    const count = opts?.count ? opts.count(s) : session.memberGroupIds(s).size
    return {
      id: s.id,
      name: s.name,
      count,
      title: opts?.title ? opts.title(count) : `${count} ${noun}`,
      hint: opts?.hint?.(s, count),
      ...session.foldFlags(s),
    }
  })
