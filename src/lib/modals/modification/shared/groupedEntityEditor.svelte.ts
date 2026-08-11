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

export interface GroupedEntityEditorConfig {
  getItems: (stimulusId: number) => ExtendedInterpretedDataType[]
  /** Stimulus the editor opens on — only for per-stimulus axes. Default 0. */
  initialStimulusId?: number
  /**
   * Rows whose displayed name is a reserved identity anchor (the Fixation
   * baseline): their name never changes (the list renders them read-only),
   * and a card where a locked row shares its displayed name with anything
   * else is an INVALID group — surfaced via `conflictsFor` /
   * `hasInvalidGroup` and dissolved with `acknowledge`, the same live-reject
   * shape `createBaseGroupEditor` uses for impossible participant merges.
   * Color and reorder stay free. Exposed back as `editor.lockedNameIds` so
   * the list and selection session read ONE source.
   */
  lockedNameIds?: ReadonlySet<number>
}

function deepCopy(
  items: ExtendedInterpretedDataType[]
): ExtendedInterpretedDataType[] {
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
    the reserved name) would be renamed through the leader fan-out. */
function renameItemIn(
  items: BaseInterpretedDataType[],
  item: BaseInterpretedDataType,
  newName: string,
  isLeader: boolean,
  group: MergeCard<BaseInterpretedDataType>,
  skipIds?: ReadonlySet<number>
) {
  if (isLeader && group.members.length > 1) {
    const memberIds = new Set(group.members.map(m => m.id))
    for (const i of items) {
      if (memberIds.has(i.id) && !skipIds?.has(i.id)) i.displayedName = newName
    }
  } else {
    const target = items.find(i => i.id === item.id)
    if (target) target.displayedName = newName
  }
}

/** Bulk find/replace over every member's displayed name. In-place mutation,
    as above; an invalid pattern is a silent no-op. `skipIds` rows keep their
    name (locked identity anchors). */
function renameAllIn(
  items: BaseInterpretedDataType[],
  pattern: string,
  replacement: string,
  skipIds?: ReadonlySet<number>
) {
  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'g')
  } catch {
    return
  }
  for (const item of items) {
    if (skipIds?.has(item.id)) continue
    item.displayedName = (item.displayedName || '').replace(regex, replacement)
  }
}

export function createGroupedEntityEditor(config: GroupedEntityEditorConfig) {
  const initialStimulusId = config.initialStimulusId ?? 0
  const lockedNameIds = config.lockedNameIds ?? new Set<number>()
  const opened = deepCopy(config.getItems(initialStimulusId))
  let items = $state(opened)
  let lastStimulusId = $state(initialStimulusId)
  // The displayed name each entity had when the modal opened — the shape
  // acknowledging an invalid locked-name group reverts to.
  let openName = new Map(opened.map(r => [r.id, r.displayedName]))

  const groups = $derived(buildGroups(items))

  /** Non-locked member ids of a group that collides with a name-locked row
      (empty = fine). A lock sharing its card with anything else means someone
      typed or bulk-renamed into the reserved name — the group can't apply. */
  function conflictsFor(group: MergeCard<BaseInterpretedDataType>): number[] {
    if (group.members.length < 2) return EMPTY_CONFLICTS
    if (!group.members.some(m => lockedNameIds.has(m.id))) return EMPTY_CONFLICTS
    return group.members.filter(m => !lockedNameIds.has(m.id)).map(m => m.id)
  }

  /** True while any on-screen group collides with a lock (blocks Apply). */
  const hasInvalidGroup = $derived(
    lockedNameIds.size > 0 && groups.some(g => conflictsFor(g).length > 0)
  )

  /** Dissolve an invalid group (locked members never renamed, so reverting
      them is a no-op — the shared dissolve covers everyone). */
  function acknowledge(group: MergeCard<BaseInterpretedDataType>) {
    dissolveGroup(items, group, openName)
  }

  /** Re-pull from the engine, discarding unapplied edits — for when a pushed
      step (e.g. Create intervals) changed the data underneath. Passing a
      stimulus id switches to it and re-pulls in the same single copy. */
  function refresh(stimulusId: number = lastStimulusId) {
    lastStimulusId = stimulusId
    const pulled = deepCopy(config.getItems(stimulusId))
    items = pulled
    openName = new Map(pulled.map(r => [r.id, r.displayedName]))
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
    for (const i of items) if (memberIds.has(i.id)) i.color = newColor
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
    renameItemIn(items, item, newName, isLeader, group, lockedNameIds)
  }

  function sort(column: string, direction: 'asc' | 'desc') {
    items = sortItems(items, column, direction)
  }

  function renameAll(pattern: string, replacement: string) {
    renameAllIn(items, pattern, replacement, lockedNameIds)
  }

  function reorderGroups(
    fromIndex: number,
    toIndex: number,
    withIds?: ReadonlySet<number>
  ) {
    items = reorderWithSet(items, fromIndex, toIndex, withIds ?? new Set())
  }

  function getCleanedItems(): ExtendedInterpretedDataType[] {
    return items.map(item => ({
      id: item.id,
      originalName: item.originalName,
      displayedName: (item.displayedName || '').trim(),
      color: item.color,
    }))
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
    lockedNameIds,
    conflictsFor,
    acknowledge,
    refresh,
    handleColorInput,
    handleNameInput,
    sort,
    renameAll,
    reorderGroups,
    getCleanedItems,
  }
}

export interface BaseGroupEditorConfig {
  /**
   * For a would-be merge group (entity ids sharing a displayed name), return
   * the conflicting counterpart ids — non-empty means the group's recordings
   * overlap and CANNOT be merged. Used to reject an invalid rename live.
   */
  detectConflicts?: (groupIds: number[]) => number[]
}

/**
 * Lighter grouped editor for the color-less Base entities (stimuli,
 * participants): live grouping by displayed name — renaming two to the same
 * name groups them on the fly, like the AOI editor, minus color/stimulus.
 *
 * Merges must be disjoint, so the rename is validated LIVE: if giving an entity
 * a name that already exists would form a group whose recordings overlap (can't
 * merge), the rename is rejected on the spot — the displayed name snaps back and
 * `error` explains why. So the list only ever shows groups that can actually
 * merge; on Apply the modal turns each multi-member group into a merge command.
 */
export function createBaseGroupEditor(
  initial: BaseInterpretedDataType[],
  config: BaseGroupEditorConfig = {}
) {
  const copy = (rows: BaseInterpretedDataType[]): BaseInterpretedDataType[] =>
    rows.map(r => ({ id: r.id, originalName: r.originalName, displayedName: r.displayedName }))

  let items = $state(copy(initial))
  // The displayed name each entity had when the modal opened — the "former
  // shape" that acknowledging an impossible merge reverts to.
  const openName = new Map(initial.map(r => [r.id, r.displayedName]))
  const groups = $derived(buildGroups(items))

  /** Conflicting counterpart ids for a group (empty = mergeable). */
  function conflictsFor(group: MergeCard<BaseInterpretedDataType>): number[] {
    if (group.members.length < 2 || !config.detectConflicts) return EMPTY_CONFLICTS
    return config.detectConflicts(group.members.map(m => m.id))
  }

  /** True while any on-screen group can't actually merge (blocks Apply). */
  const hasInvalidGroup = $derived(
    groups.some(g => conflictsFor(g).length > 0)
  )

  function handleNameInput(
    item: BaseInterpretedDataType,
    newName: string,
    isLeader: boolean,
    group: MergeCard<BaseInterpretedDataType>
  ) {
    renameItemIn(items, item, newName, isLeader, group)
  }

  /** Dissolve a group (used to undo an impossible merge). */
  function acknowledge(group: MergeCard<BaseInterpretedDataType>) {
    dissolveGroup(items, group, openName)
  }

  function sort(column: string, direction: 'asc' | 'desc') {
    items = sortItems(items, column, direction)
  }

  function renameAll(pattern: string, replacement: string) {
    renameAllIn(items, pattern, replacement)
    // Any group a bulk rename forms is validated the same way as a manual one:
    // an impossible merge shows its notice + Undo, and blocks Apply.
  }

  function reorderGroups(
    fromIndex: number,
    toIndex: number,
    withIds?: ReadonlySet<number>
  ) {
    items = reorderWithSet(items, fromIndex, toIndex, withIds ?? new Set())
  }

  /** Trimmed, id-keyed copy for committing the rename. */
  function getItems(): BaseInterpretedDataType[] {
    return items.map(i => ({
      id: i.id,
      originalName: i.originalName,
      displayedName: (i.displayedName || '').trim(),
    }))
  }

  return {
    get groups() {
      return groups
    },
    get hasInvalidGroup() {
      return hasInvalidGroup
    },
    conflictsFor,
    handleNameInput,
    acknowledge,
    sort,
    renameAll,
    reorderGroups,
    getItems,
  }
}
