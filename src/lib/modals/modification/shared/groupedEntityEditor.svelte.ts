import type {
  BaseInterpretedDataType,
  ExtendedInterpretedDataType,
} from '$lib/data/types'
import { groupByDisplayedName } from '$lib/data/engine/utils/grouping'
import { sortItems } from './sort'

/**
 * One editor card: the entities sharing a displayed name, i.e. a displayed-name
 * MERGE (a single member = an unmerged entity). This is the MERGE primitive of
 * the entity modals; the SELECTION primitive (per-plot member sets) is separate
 * — see {@link NameSelection}. Named `MergeCard` (not "group") to keep the two
 * vocabularies unambiguous.
 */
export interface MergeCard<
  T extends BaseInterpretedDataType = ExtendedInterpretedDataType,
> {
  id: number
  members: T[]
}

export interface GroupedEntityEditorConfig<T extends BaseInterpretedDataType> {
  getItems: (stimulusId: number) => T[]
  /** Stimulus the editor opens on — only for per-stimulus axes. Default 0. */
  initialStimulusId?: number
  /**
   * Rows whose displayed name is a reserved identity anchor (the Fixation
   * baseline): their name never changes (the list renders them read-only),
   * and a card where a locked row shares its displayed name with anything
   * else is an INVALID group — surfaced via `conflictsFor` /
   * `hasInvalidGroup` and dissolved with `acknowledge`, the same live-reject
   * shape `detectConflicts` uses for impossible merges. Color and reorder
   * stay free. Exposed back as `editor.lockedNameIds` so the list and
   * selection session read ONE source.
   */
  lockedNameIds?: ReadonlySet<number>
  /**
   * MERGE axes (stimuli, participants): for a would-be merge group, the
   * conflicting counterpart ids. Non-empty means the recordings overlap and
   * CANNOT merge, so the group is invalid; replaces the locked-name rule.
   */
  detectConflicts?: (groupIds: number[]) => number[]
}

function deepCopy<T extends BaseInterpretedDataType>(items: T[]): T[] {
  // Spread keeps caller-attached display-only keys (e.g. the AOI modal's
  // all-stimuli `stimuliLabel`) alongside the canonical four fields.
  return items.map(item => ({ ...item }))
}

/**
 * Reorder with multi-drag: the dragged group plus every group in `movingIds`
 * travel as one contiguous block (relative order preserved) to the drop slot.
 * `fromIndex`/`toIndex` follow the single-drag contract of `listReorder`
 * (toIndex indexes the list WITHOUT the dragged card); an empty `movingIds`
 * degenerates to exactly that single-drag behavior.
 */
function reorderWithSet<T extends BaseInterpretedDataType>(
  items: T[],
  fromIndex: number,
  toIndex: number,
  movingIds: ReadonlySet<number>
): T[] {
  const current = buildGroups(items)
  const dragged = current[fromIndex]
  if (!dragged) return items
  const moving = new Set(movingIds)
  moving.add(dragged.id)
  const without = current.filter((_, i) => i !== fromIndex)
  const rest = current.filter(g => !moving.has(g.id))
  // The drop anchor is whatever occupies the slot; if that is itself moving,
  // the block lands before the next stationary group.
  let anchor: MergeCard<T> | null = null
  for (let i = toIndex; i < without.length; i++) {
    if (!moving.has(without[i].id)) {
      anchor = without[i]
      break
    }
  }
  const p = anchor ? rest.indexOf(anchor) : rest.length
  const movingGroups = current.filter(g => moving.has(g.id))
  const ordered = [...rest.slice(0, p), ...movingGroups, ...rest.slice(p)]
  const out: T[] = []
  for (const g of ordered) {
    for (const m of g.members) out.push(items.find(i => i.id === m.id)!)
  }
  return out
}

/** Cards from the engine's canonical "same displayed name = same entity" rule
    (trimmed match, first-occurrence order, empty names standalone, leader =
    first member). Fed a minimal projection so the `groups` derived reads ONLY
    `id`/`displayedName` — never `color` — see handleColorInput. */
function buildGroups<T extends BaseInterpretedDataType>(
  items: T[]
): MergeCard<T>[] {
  const byId = new Map(items.map(i => [i.id, i]))
  return groupByDisplayedName(
    items.map(i => ({ id: i.id, displayedName: i.displayedName }))
  ).map(g => ({ id: g.id, members: g.memberIds.map(id => byId.get(id)!) }))
}

/** Shared empty result for the no-conflict fast path (avoids an allocation
    per group per recompute). */
const EMPTY_CONFLICTS: number[] = []

/** Dissolve a group by returning every member's displayed name to the shape
    it had when the modal opened — the acknowledge step of the invalid-group
    protocol both editors share. */
function dissolveGroup(
  items: BaseInterpretedDataType[],
  group: MergeCard<BaseInterpretedDataType>,
  openName: ReadonlyMap<number, string>
) {
  const ids = new Set(group.members.map(m => m.id))
  for (const i of items) {
    if (ids.has(i.id)) i.displayedName = openName.get(i.id) ?? i.displayedName
  }
}

/** Renaming the leader of a multi-member group renames every member (keeping
    them grouped); any other rename touches just the one item. In-place
    mutation so `groups` re-derives (and regroups) reactively. `skipIds` rows
    never rename — without it, a locked row folded into a card (someone typed
    the reserved name) would be renamed through the leader fan-out. Returns
    the ids written (the editor's touched-field bookkeeping). */
function renameItemIn(
  items: BaseInterpretedDataType[],
  item: BaseInterpretedDataType,
  newName: string,
  isLeader: boolean,
  group: MergeCard<BaseInterpretedDataType>,
  skipIds?: ReadonlySet<number>
): number[] {
  const written: number[] = []
  if (isLeader && group.members.length > 1) {
    const memberIds = new Set(group.members.map(m => m.id))
    for (const i of items) {
      if (memberIds.has(i.id) && !skipIds?.has(i.id)) {
        i.displayedName = newName
        written.push(i.id)
      }
    }
  } else {
    const target = items.find(i => i.id === item.id)
    if (target) {
      target.displayedName = newName
      written.push(target.id)
    }
  }
  return written
}

/** Bulk find/replace over every member's displayed name. In-place mutation,
    as above; an invalid pattern is a silent no-op. `skipIds` rows keep their
    name (locked identity anchors). Returns the ids whose name actually
    changed — a pattern that misses a row must not count as editing it. */
function renameAllIn(
  items: BaseInterpretedDataType[],
  pattern: string,
  replacement: string,
  skipIds?: ReadonlySet<number>
): number[] {
  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'g')
  } catch {
    return []
  }
  const changed: number[] = []
  for (const item of items) {
    if (skipIds?.has(item.id)) continue
    const next = (item.displayedName || '').replace(regex, replacement)
    if (next !== item.displayedName) {
      item.displayedName = next
      changed.push(item.id)
    }
  }
  return changed
}

export function createGroupedEntityEditor<
  T extends BaseInterpretedDataType = ExtendedInterpretedDataType,
>(config: GroupedEntityEditorConfig<T>) {
  const initialStimulusId = config.initialStimulusId ?? 0
  const lockedNameIds = config.lockedNameIds ?? new Set<number>()
  const opened = deepCopy(config.getItems(initialStimulusId))
  let items = $state(opened)
  let lastStimulusId = $state(initialStimulusId)
  // The displayed name each entity had when the modal opened — the shape
  // acknowledging an invalid locked-name group reverts to.
  let openName = new Map(opened.map(r => [r.id, r.displayedName]))

  const groups = $derived(buildGroups(items))

  // Which rows the user EDITED, per field, since open/refresh — by id, so
  // sort/reorder (array replacement, same objects) stay neutral. Distinct from
  // "value differs from open": re-picking the shown color IS an edit, which is
  // how the AOI modal's all-stimuli scope unifies divergent per-stimulus values
  // to the value on screen. Plain Sets: written inside the same handler as the
  // item mutation and read at Apply, so they need no reactivity of their own.
  const touched = { name: new Set<number>(), color: new Set<number>() }

  /** Conflicting ids of a group (empty = fine): `detectConflicts` when set,
      else the non-locked members of a card that collides with a name-locked
      row (someone typed or bulk-renamed into the reserved name). */
  function conflictsFor(group: MergeCard<BaseInterpretedDataType>): number[] {
    if (group.members.length < 2) return EMPTY_CONFLICTS
    if (config.detectConflicts) {
      return config.detectConflicts(group.members.map(m => m.id))
    }
    if (!group.members.some(m => lockedNameIds.has(m.id))) return EMPTY_CONFLICTS
    return group.members.filter(m => !lockedNameIds.has(m.id)).map(m => m.id)
  }

  /** True while any on-screen group is invalid (blocks Apply). */
  const hasInvalidGroup = $derived(groups.some(g => conflictsFor(g).length > 0))

  /** Dissolve an invalid group (locked members never renamed, so reverting
      them is a no-op — the shared dissolve covers everyone). Reverting to the
      open name un-edits those rows. */
  function acknowledge(group: MergeCard<BaseInterpretedDataType>) {
    dissolveGroup(items, group, openName)
    for (const m of group.members) touched.name.delete(m.id)
  }

  /** Re-pull from the engine, discarding unapplied edits — for when a pushed
      step (e.g. Create intervals) changed the data underneath. Passing a
      stimulus id switches to it and re-pulls in the same single copy. */
  function refresh(stimulusId: number = lastStimulusId) {
    lastStimulusId = stimulusId
    const pulled = deepCopy(config.getItems(stimulusId))
    items = pulled
    openName = new Map(pulled.map(r => [r.id, r.displayedName]))
    touched.name.clear()
    touched.color.clear()
  }

  /** Re-pull like `refresh`, then put the edited names and colors back on
      the rows that still exist: for a step that only ADDED rows (Create
      intervals), so new rows appear without losing staged edits. Order is
      re-pulled. */
  function refreshKeepingEdits() {
    const staged = new Map(items.map(item => [item.id, { ...item }]))
    const names = new Set(touched.name)
    const colors = new Set(touched.color)
    refresh()
    for (const item of items) {
      const was = staged.get(item.id)
      if (!was) continue
      if (names.has(item.id)) {
        item.displayedName = was.displayedName
        touched.name.add(item.id)
      }
      if (colors.has(item.id) && 'color' in was) {
        ;(item as T & ExtendedInterpretedDataType).color = was.color as string
        delete (item as { mixedColors?: unknown }).mixedColors
        touched.color.add(item.id)
      }
    }
  }

  function handleColorInput(
    group: MergeCard<BaseInterpretedDataType>,
    newColor: string
  ) {
    // Every member gets the color, not just the leader: a merged entity has
    // ONE color, and a leader-only write leaves members stale — repainted
    // wherever THEY lead (e.g. per-stimulus order after an all-stimuli merge).
    // In-place mutation, NOT array replacement. With Svelte 5 deep-proxy
    // $state, this invalidates only consumers that read `.color` on these
    // specific items — `buildGroups` (which reads `.id` and `.displayedName`
    // only) doesn't re-run, and the table re-renders just the one swatch.
    // Replacing `items = items.map(...)` here caused O(N²) re-derivation
    // and full-table re-renders per color-picker input event.
    const memberIds = new Set(group.members.map(m => m.id))
    for (const i of items) {
      if (memberIds.has(i.id)) {
        ;(i as T & ExtendedInterpretedDataType).color = newColor
        // A picked color is one color: a "Mixed" swatch turns solid.
        delete (i as { mixedColors?: unknown }).mixedColors
        touched.color.add(i.id)
      }
    }
  }

  function handleNameInput(
    item: BaseInterpretedDataType,
    newName: string,
    isLeader: boolean,
    group: MergeCard<BaseInterpretedDataType>
  ) {
    // Locked rows never rename — the list renders them read-only; this also
    // covers the tray's Merge verb, whose fold is a plain rename. The set is
    // ALSO threaded into the leader fan-out: when a locked row sits as a
    // MEMBER of an invalid card, renaming the card's leader must not carry it.
    if (lockedNameIds.has(item.id)) return
    for (const id of renameItemIn(items, item, newName, isLeader, group, lockedNameIds)) {
      touched.name.add(id)
    }
  }

  function sort(column: string, direction: 'asc' | 'desc') {
    items = sortItems(items, column, direction)
  }

  function renameAll(pattern: string, replacement: string) {
    for (const id of renameAllIn(items, pattern, replacement, lockedNameIds)) {
      touched.name.add(id)
    }
  }

  function reorderGroups(
    fromIndex: number,
    toIndex: number,
    withIds?: ReadonlySet<number>
  ) {
    items = reorderWithSet(items, fromIndex, toIndex, withIds ?? new Set())
  }

  /** Trimmed copy of the canonical fields (plus color where the axis has one). */
  function getCleanedItems(): T[] {
    return items.map(item => {
      const { id, originalName } = item
      const displayedName = (item.displayedName || '').trim()
      const out = { id, originalName, displayedName }
      return ('color' in item ? { ...out, color: item.color } : out) as T
    })
  }

  return {
    get items() {
      return items
    },
    get groups() {
      return groups
    },
    get hasInvalidGroup() {
      return hasInvalidGroup
    },
    /** Rows edited per field since open/refresh (see `touched` above). */
    get touched(): { name: ReadonlySet<number>; color: ReadonlySet<number> } {
      return touched
    },
    lockedNameIds,
    conflictsFor,
    acknowledge,
    refresh,
    refreshKeepingEdits,
    handleColorInput,
    handleNameInput,
    sort,
    renameAll,
    reorderGroups,
    getCleanedItems,
  }
}
