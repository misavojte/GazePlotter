import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { sortItems, reorderItems } from './sort'

export interface EntityGroup {
  id: number
  members: ExtendedInterpretedDataType[]
}

export interface GroupedEntityEditorConfig {
  getItems: (stimulusId: number) => ExtendedInterpretedDataType[]
  getHidden: (stimulusId: number) => number[]
  initialStimulusId: number
}

function deepCopy(
  items: ExtendedInterpretedDataType[]
): ExtendedInterpretedDataType[] {
  return items.map(item => ({
    id: item.id,
    originalName: item.originalName,
    displayedName: item.displayedName,
    color: item.color,
  }))
}

function isValidMatch(displayedName: string): boolean {
  return (
    typeof displayedName === 'string' &&
    displayedName.trim() !== '' &&
    displayedName !== undefined
  )
}

function buildGroups(
  items: ExtendedInterpretedDataType[]
): EntityGroup[] {
  const seen = new Set<string>()
  const groups: EntityGroup[] = []

  for (const item of items) {
    const trimmed = (item.displayedName || '').trim()
    if (!isValidMatch(trimmed)) {
      groups.push({ id: item.id, members: [item] })
      continue
    }
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    const members = items.filter(
      i => (i.displayedName || '').trim() === trimmed
    )
    groups.push({ id: members[0].id, members })
  }

  return groups
}

export function createGroupedEntityEditor(config: GroupedEntityEditorConfig) {
  const rawItems = config.getItems(config.initialStimulusId)
  let items = $state(deepCopy(rawItems))

  const initialHidden = config.getHidden(config.initialStimulusId)
  let hiddenIds: number[] = $state([...initialHidden])
  let lastHiddenSnapshot = $state([...initialHidden])

  let lastStimulusId = $state(config.initialStimulusId)

  const hiddenSet = $derived(new Set(hiddenIds))
  const groups = $derived(buildGroups(items))
  const hasGroups = $derived(groups.some(g => g.members.length > 1))

  function syncStimulus(stimulusId: number) {
    if (stimulusId === lastStimulusId) return
    items = deepCopy(config.getItems(stimulusId))
    lastStimulusId = stimulusId

    const nextHidden = config.getHidden(stimulusId)
    hiddenIds = [...nextHidden]
    lastHiddenSnapshot = [...nextHidden]
  }

  /** Re-pull the current stimulus, discarding unapplied edits — for when
      a pushed step (e.g. Create intervals) changed the data underneath. */
  function refresh() {
    items = deepCopy(config.getItems(lastStimulusId))
    const nextHidden = config.getHidden(lastStimulusId)
    hiddenIds = [...nextHidden]
    lastHiddenSnapshot = [...nextHidden]
  }

  function toggleActive(group: EntityGroup, active: boolean) {
    const affectedIds = group.members.map(m => m.id)
    if (active) {
      hiddenIds = hiddenIds.filter(id => !affectedIds.includes(id))
    } else {
      hiddenIds = Array.from(new Set([...hiddenIds, ...affectedIds]))
    }
  }

  function handleColorInput(group: EntityGroup, newColor: string) {
    // In-place mutation, NOT array replacement. With Svelte 5 deep-proxy
    // $state, this invalidates only consumers that read `.color` on this
    // specific item — `buildGroups` (which reads `.id` and `.displayedName`
    // only) doesn't re-run, and the table re-renders just the one swatch.
    // Replacing `items = items.map(...)` here caused O(N²) re-derivation
    // and full-table re-renders per color-picker input event.
    const leaderId = group.members[0].id
    const leader = items.find(i => i.id === leaderId)
    if (leader) leader.color = newColor
  }

  function handleNameInput(
    item: ExtendedInterpretedDataType,
    newName: string,
    isLeader: boolean,
    group: EntityGroup
  ) {
    if (isLeader && group.members.length > 1) {
      const memberIds = new Set(group.members.map(m => m.id))
      for (const i of items) {
        if (memberIds.has(i.id)) {
          i.displayedName = newName
        }
      }
    } else {
      const original = items.find(i => i.id === item.id)
      if (original) {
        original.displayedName = newName

        const trimmedName = (newName || '').trim()
        if (isValidMatch(trimmedName)) {
          const groupMember = items.find(
            i =>
              i.id !== item.id &&
              (i.displayedName || '').trim() === trimmedName
          )
          if (groupMember) {
            const isGroupHidden = hiddenIds.includes(groupMember.id)
            if (isGroupHidden) {
              if (!hiddenIds.includes(item.id)) {
                hiddenIds = [...hiddenIds, item.id]
              }
            } else {
              hiddenIds = hiddenIds.filter(id => id !== item.id)
            }
          }
        }
      }
    }
  }

  function sort(column: string, direction: 'asc' | 'desc') {
    items = sortItems(items, column, direction)
  }

  /** Bulk find/replace over every member's displayed name. In-place
      mutation so `groups` re-derives (and regroups) reactively. */
  function renameAll(pattern: string, replacement: string) {
    let regex: RegExp
    try {
      regex = new RegExp(pattern, 'g')
    } catch {
      return
    }
    for (const item of items) {
      item.displayedName = (item.displayedName || '').replace(regex, replacement)
    }
  }

  function reorderGroups(fromIndex: number, toIndex: number) {
    const currentGroups = buildGroups(items)
    const dragged = currentGroups[fromIndex]
    const without = currentGroups.filter((_, i) => i !== fromIndex)
    without.splice(toIndex, 0, dragged)

    const newOrder: ExtendedInterpretedDataType[] = []
    for (const g of without) {
      for (const m of g.members) {
        newOrder.push(items.find(i => i.id === m.id)!)
      }
    }
    items = newOrder
  }

  function getCleanedItems(): ExtendedInterpretedDataType[] {
    return items.map(item => ({
      id: item.id,
      originalName: item.originalName,
      displayedName: (item.displayedName || '').trim(),
      color: item.color,
    }))
  }

  function getCleanedHiddenIds(): number[] {
    return Array.from(
      new Set(hiddenIds.filter(v => Number.isInteger(v) && v >= 0))
    ).sort((a, b) => a - b)
  }

  function commitHiddenSnapshot() {
    lastHiddenSnapshot = [...getCleanedHiddenIds()]
  }

  return {
    get items() {
      return items
    },
    get groups() {
      return groups
    },
    get hasGroups() {
      return hasGroups
    },
    get hiddenSet() {
      return hiddenSet
    },
    get hiddenIds() {
      return hiddenIds
    },
    syncStimulus,
    refresh,
    toggleActive,
    handleColorInput,
    handleNameInput,
    sort,
    renameAll,
    reorderGroups,
    getCleanedItems,
    getCleanedHiddenIds,
    commitHiddenSnapshot,
  }
}
