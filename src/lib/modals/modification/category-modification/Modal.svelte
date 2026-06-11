<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getAllCategories, getHiddenCategories } from '$lib/data/engine'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import { sortItems } from '../shared/sort'
  import type { ExtendedInterpretedDataType } from '$lib/data/types'
  import { FIXATION_CATEGORY_ID } from '$lib/data/types'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { engine, modalState, workspace } = getGazePlotterSession()

  // Get raw items excluding Fixations
  const rawItems = getAllCategories(engine).filter(c => c.id !== FIXATION_CATEGORY_ID)
  
  // Svelte 5 state copy
  let items = $state(rawItems.map(item => ({
    id: item.id,
    originalName: item.originalName,
    displayedName: item.displayedName,
    color: item.color,
  })))
  
  const initialHidden = getHiddenCategories(engine)
  let hiddenIds = $state([...initialHidden])

  const hiddenSet = $derived(new Set(hiddenIds))
  const groups = $derived(buildGroups(items))
  const hasGroups = $derived(groups.some(g => g.members.length > 1))

  function buildGroups(
    items: ExtendedInterpretedDataType[]
  ) {
    const seen = new Set<string>()
    const groups: { id: number; members: ExtendedInterpretedDataType[] }[] = []

    for (const item of items) {
      const trimmed = (item.displayedName || '').trim()
      if (trimmed === '') {
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

  const handleSubmit = () => {
    const cleanedItems = items.map(item => ({
      id: item.id,
      originalName: item.originalName,
      displayedName: (item.displayedName || '').trim(),
      color: item.color,
    }))

    const cleanedHiddenIds = Array.from(
      new Set(hiddenIds.filter(v => Number.isInteger(v) && v >= 0))
    ).sort((a, b) => a - b)

    // Save changes using workspace command to support undo/redo!
    workspace.updateCategories(cleanedItems, source, cleanedHiddenIds)
    modalState.close()
  }

  function toggleActive(group: any, active: boolean) {
    const affectedIds = group.members.map((m: any) => m.id)
    if (active) {
      hiddenIds = hiddenIds.filter(id => !affectedIds.includes(id))
    } else {
      hiddenIds = Array.from(new Set([...hiddenIds, ...affectedIds]))
    }
  }

  function handleColorInput(group: any, newColor: string) {
    const memberIds = new Set(group.members.map((m: any) => m.id))
    for (const i of items) {
      if (memberIds.has(i.id)) {
        i.color = newColor
      }
    }
  }

  function handleNameInput(
    item: ExtendedInterpretedDataType,
    newName: string,
    isLeader: boolean,
    group: any
  ) {
    if (isLeader && group.members.length > 1) {
      const memberIds = new Set(group.members.map((m: any) => m.id))
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
        if (trimmedName !== '') {
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

  function sort(column: string, direction: 'asc' | 'desc') {
    items = sortItems(items, column, direction)
  }

  const COLUMNS = [
    { label: 'Move', width: '28px', type: 'handle' as const },
    { label: 'Original', width: '1fr', type: 'readonly' as const, key: 'originalName' },
    { label: 'Displayed', width: '1fr', type: 'text' as const, key: 'displayedName' },
    { label: 'Color', width: '40px', type: 'color' as const, align: 'center' as const },
    { label: 'Visible', width: '40px', type: 'checkbox' as const, align: 'center' as const },
  ]

  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]
</script>

<Section>
  <EditableEntityList
    items={groups}
    title="Eye-movement Types"
    emptyMessage="No eye-movement categories found"
    columns={COLUMNS}
    sortColumns={SORT_COLUMNS}
    hintText={hasGroups ? undefined : 'Name Eye-movement Types the same to <strong>group</strong> them together'}
    onSort={sort}
    onReorder={reorderGroups}
    grouped={{
      hiddenSet,
      onNameInput: handleNameInput,
      onColorInput: handleColorInput,
      onToggleActive: toggleActive,
    }}
  />

  <ModalButtons
    buttons={[
      { label: 'Apply', onclick: handleSubmit, variant: 'primary' },
      { label: 'Cancel', onclick: () => modalState.close() },
    ]}
  />
</Section>
