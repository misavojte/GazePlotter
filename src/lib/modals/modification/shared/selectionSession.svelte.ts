import { contextMenuState } from '$lib/context-menu'
import type { BaseInterpretedDataType } from '$lib/data/types'
import type { MergeCard } from './groupedEntityEditor.svelte'

type Group = MergeCard<BaseInterpretedDataType>

export interface SelectionLike {
  id: number
  name: string
}

/**
 * The entity-specific half of a selection session: how membership is stored.
 * Name-keyed (AOIs), id-keyed (participants, and the future events /
 * eye-movement types / stimuli) — everything else is shared mechanics.
 */
export interface SelectionSessionConfig<TSel extends SelectionLike> {
  initial: TSel[]
  /** The active editor's groups (a card = one logical entity). */
  groups: () => Group[]
  /** Group ids that cannot ring or toggle while editing a saved selection. */
  inertIds?: () => ReadonlySet<number>
  isMember: (sel: TSel, group: Group) => boolean
  /** Immutable membership update: `groups` switched on/off in `sel`. */
  withMembers: (sel: TSel, groups: Group[], on: boolean) => TSel
  create: (id: number, seed: Group[]) => TSel
  /** The editor's rename path — Merge/Split are plain renames, so entity
      validation (e.g. participant overlap) fires exactly as if typed. */
  renameItem: (
    item: BaseInterpretedDataType,
    name: string,
    isLeader: boolean,
    group: Group
  ) => void
  reorderGroups: (from: number, to: number, withIds?: ReadonlySet<number>) => void
  notify: (message: string) => void
}

/**
 * ONE selection mechanism for every entity modal: clicking cards builds a
 * TRANSIENT working set (merge / split / save / multi-drag) or, while a
 * SELECTION chip is active, edits that chip's membership. Owns the state
 * machine, the tray verbs, the chip fold-ins, and the Esc / click-away
 * unwinding; the modal supplies membership semantics via the config.
 */
export function createSelectionSession<TSel extends SelectionLike>(
  cfg: SelectionSessionConfig<TSel>
) {
  let selections = $state(cfg.initial)
  let editingId = $state<number | null>(null)
  let hoveredId = $state<number | null>(null)
  // Rename focus is primed only by "+ New" (naming is the intent there);
  // a plain chip open must not preselect the name under stray keystrokes.
  let nameFocusPending = $state(false)
  let transientIds = $state(new Set<number>())
  // Monotonic ids: never recycle a dissolved selection's id — panes pinned
  // to the old id would silently show the unrelated newcomer.
  let nextSelId = Math.max(0, ...cfg.initial.map(s => s.id)) + 1

  const editingSelection = $derived(
    selections.find(s => s.id === editingId) ?? null
  )
  const selectedGroups = $derived(
    cfg.groups().filter(g => transientIds.has(g.id))
  )
  const memberGroupIds = (sel: TSel): Set<number> =>
    new Set(
      cfg
        .groups()
        .filter(g => cfg.isMember(sel, g))
        .map(g => g.id)
    )
  const markedIds = $derived(
    editingSelection ? memberGroupIds(editingSelection) : new Set<number>()
  )
  const previewIds = $derived.by(() => {
    if (editingId !== null || hoveredId === null) return null
    const sel = selections.find(s => s.id === hoveredId)
    return sel ? memberGroupIds(sel) : null
  })
  // The bulk verbs act on every selectable row.
  const visibleOps = $derived.by(() => {
    const gs = cfg.groups()
    const inert = editingSelection ? cfg.inertIds?.() : undefined
    return inert ? gs.filter(g => !inert.has(g.id)) : gs
  })
  const allVisibleSelected = $derived.by(() => {
    const on = editingSelection ? markedIds : transientIds
    return visibleOps.length > 0 && visibleOps.every(g => on.has(g.id))
  })
  const mergeTargetName = $derived.by(() => {
    if (selectedGroups.length < 2) return undefined
    const leader = selectedGroups[0].members[0]
    return (leader.displayedName || '').trim() || leader.originalName
  })
  const canSplit = $derived(selectedGroups.some(g => g.members.length > 1))

  const updateSelection = (id: number, patch: Partial<TSel>) => {
    selections = selections.map(s => (s.id === id ? { ...s, ...patch } : s))
  }

  // ── Toggling: one gesture, two meanings ────────────────────────────────────
  const toggleTransient = (group: Group) => {
    const next = new Set(transientIds)
    if (next.has(group.id)) next.delete(group.id)
    else next.add(group.id)
    transientIds = next
  }
  const setTransientMany = (groups: Group[], on: boolean) => {
    const next = new Set(transientIds)
    for (const g of groups) {
      if (on) next.add(g.id)
      else next.delete(g.id)
    }
    transientIds = next
  }
  const toggleBound = (group: Group) => {
    const sel = editingSelection
    if (!sel) return
    updateSelection(sel.id, cfg.withMembers(sel, [group], !cfg.isMember(sel, group)))
  }
  const setBound = (groups: Group[], on: boolean) => {
    const sel = editingSelection
    if (!sel) return
    updateSelection(sel.id, cfg.withMembers(sel, groups, on))
  }

  /** The exact `selection` prop EditableEntityList renders from. */
  const listSelection = $derived(
    editingSelection
      ? {
          selected: markedIds,
          variant: 'saved' as const,
          inert: cfg.inertIds?.(),
          onToggle: toggleBound,
          onSetMany: setBound,
        }
      : {
          selected: transientIds,
          variant: 'transient' as const,
          onToggle: toggleTransient,
          onSetMany: setTransientMany,
        }
  )

  // listSelection already routes to the bound or transient setter.
  const selectVisible = () => listSelection.onSetMany(visibleOps, true)
  const clearVisible = () => listSelection.onSetMany(visibleOps, false)

  // ── Verbs on the transient selection ───────────────────────────────────────
  const mergeSelected = () => {
    const sel = selectedGroups
    if (!mergeTargetName) return // defined only once 2+ groups are selected
    for (const g of sel.slice(1)) {
      cfg.renameItem(g.members[0], mergeTargetName, true, g)
    }
    transientIds = new Set([sel[0].id])
  }

  // Inverse of Merge: every member of a selected merged card gets its
  // original name back; the resulting single cards stay selected.
  const splitSelected = () => {
    const merged = selectedGroups.filter(g => g.members.length > 1)
    if (merged.length === 0) return
    const keep = new Set(transientIds)
    for (const g of merged) {
      for (const m of g.members) {
        cfg.renameItem(m, m.originalName, false, g)
        keep.add(m.id)
      }
    }
    transientIds = keep
  }

  // ── Selections lifecycle ───────────────────────────────────────────────────
  const createSelection = (seed: Group[] = []) => {
    const id = nextSelId++
    selections = [...selections, cfg.create(id, seed)]
    nameFocusPending = true
    editingId = id
  }
  const openSelection = (id: number) => {
    // Explicitly offered Add/Remove and declined: the transient has no
    // remaining purpose once editing starts.
    transientIds = new Set()
    nameFocusPending = false
    editingId = id
  }
  const removeSelection = (id: number) => {
    const removed = selections.find(s => s.id === id)
    selections = selections.filter(s => s.id !== id)
    if (editingId === id) editingId = null
    if (removed) cfg.notify(`Dissolved selection "${removed.name}".`)
  }
  const done = () => {
    nameFocusPending = false
    editingId = null
  }
  // "+ New" doubles as "Save as selection" while a transient set exists.
  // Gate on selectedGroups (not raw transientIds): a sort or regroup can
  // change a group's leader id, orphaning stale ids that match no card.
  const newOrSave = () => {
    if (editingId === null && selectedGroups.length > 0) {
      const seed = selectedGroups
      transientIds = new Set()
      createSelection(seed)
    } else {
      createSelection()
    }
  }

  // Fold the transient selection into an existing SELECTION (chip menu).
  // The transient survives — assigning one working set to several selections
  // in a row is a real workflow — so the toast is the confirmation.
  const addSelectedTo = (id: number) => {
    const sel = selections.find(s => s.id === id)
    if (!sel) return
    const adding = selectedGroups.filter(g => !cfg.isMember(sel, g))
    if (adding.length === 0) return
    updateSelection(id, cfg.withMembers(sel, adding, true))
    cfg.notify(`Added ${adding.length} to "${sel.name}".`)
  }
  const removeSelectedFrom = (id: number) => {
    const sel = selections.find(s => s.id === id)
    if (!sel) return
    const removing = selectedGroups.filter(g => cfg.isMember(sel, g))
    if (removing.length === 0) return
    updateSelection(id, cfg.withMembers(sel, removing, false))
    cfg.notify(`Removed ${removing.length} from "${sel.name}".`)
  }
  /** Chip-menu verb availability against the transient selection. */
  const foldFlags = (sel: TSel) => ({
    addable: selectedGroups.some(g => !cfg.isMember(sel, g)),
    removable: selectedGroups.some(g => cfg.isMember(sel, g)),
  })

  // ── Multi-drag: a selected card drags the whole selected block ────────────
  const handleReorder = (from: number, to: number) => {
    const g = cfg.groups()[from]
    const multi =
      editingId === null &&
      g !== undefined &&
      transientIds.size > 1 &&
      transientIds.has(g.id)
    cfg.reorderGroups(from, to, multi ? transientIds : undefined)
  }

  // ── Esc / click-away unwinding ─────────────────────────────────────────────
  // Esc unwinds one layer at a time BEFORE the modal's own Esc-close can fire
  // (capture beats the host's bubble listener): open flyout, chip editing,
  // then the transient selection, then the modal.
  const onEscCapture = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    // An open flyout owns this Esc — but nothing in its path consumes the
    // event, and the modal host's window listener would close the WHOLE
    // modal (discarding staged work). Close the menu here and stop it.
    if (contextMenuState.current) {
      e.stopPropagation()
      contextMenuState.reset()
      return
    }
    // Esc inside the bubble's rename input is the field's (blur, consume).
    const t = e.target as HTMLElement | null
    if (t?.tagName === 'INPUT' && t.closest('.bubble')) return
    if (editingId !== null) {
      e.stopPropagation()
      done()
      return
    }
    if (transientIds.size > 0) {
      e.stopPropagation()
      transientIds = new Set()
    }
  }

  // Clicking anywhere in the modal outside the list and the tray ends the
  // selection-editing episode — the natural dismiss alongside Esc and the
  // active chip. Portaled overlays (menus, color popup) never count.
  const onOutsideDown = (e: PointerEvent) => {
    if (editingId === null) return
    if (contextMenuState.current) return
    const t = e.target as HTMLElement | null
    if (!t?.closest) return
    if (
      t.closest(
        '.entity-grid, .section-title-row, .tray, .color-popup, .context-menu'
      )
    ) {
      return
    }
    if (t.closest('.modal')) done()
  }

  return {
    get selections() {
      return selections
    },
    get editingId() {
      return editingId
    },
    get editingSelection() {
      return editingSelection
    },
    get selectedGroups() {
      return selectedGroups
    },
    /** Transient size for the tray (0 while a chip is active). */
    get selectedCount() {
      return editingId === null ? selectedGroups.length : 0
    },
    get visibleCount() {
      return visibleOps.length
    },
    get allVisibleSelected() {
      return allVisibleSelected
    },
    get mergeTargetName() {
      return mergeTargetName
    },
    get canMerge() {
      return selectedGroups.length >= 2
    },
    get canSplit() {
      return canSplit
    },
    get listSelection() {
      return listSelection
    },
    get previewIds() {
      return previewIds
    },
    get nameFocusPending() {
      return nameFocusPending
    },
    memberGroupIds,
    foldFlags,
    updateSelection,
    selectVisible,
    clearVisible,
    mergeSelected,
    splitSelected,
    createSelection,
    openSelection,
    removeSelection,
    done,
    newOrSave,
    addSelectedTo,
    removeSelectedFrom,
    handleReorder,
    onEscCapture,
    onOutsideDown,
    setHovered(id: number | null) {
      hoveredId = id
    },
    clearTransient() {
      transientIds = new Set()
    },
  }
}

/** The non-generic surface the tray consumes — deliberately free of any
    generic-dependent parameter so every entity's session satisfies it. */
export interface SelectionSessionApi {
  readonly editingId: number | null
  readonly selectedCount: number
  readonly visibleCount: number
  readonly allVisibleSelected: boolean
  readonly mergeTargetName: string | undefined
  readonly canMerge: boolean
  readonly canSplit: boolean
  readonly nameFocusPending: boolean
  updateSelection(id: number, patch: { name?: string }): void
  selectVisible(): void
  clearVisible(): void
  mergeSelected(): void
  splitSelected(): void
  openSelection(id: number): void
  removeSelection(id: number): void
  done(): void
  newOrSave(): void
  addSelectedTo(id: number): void
  removeSelectedFrom(id: number): void
  setHovered(id: number | null): void
  onEscCapture(e: KeyboardEvent): void
  onOutsideDown(e: PointerEvent): void
}