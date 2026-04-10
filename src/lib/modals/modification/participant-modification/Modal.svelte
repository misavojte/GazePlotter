<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { getAllParticipants } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import type { BaseInterpretedDataType } from '$lib/data/types'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import RenameToolbar from '../shared/RenameToolbar.svelte'
  import { sortItems, reorderItems } from '../shared/sort'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { modalState, workspace, engine } = getGazePlotterSession()

  const deepCopy = (items: BaseInterpretedDataType[]): BaseInterpretedDataType[] =>
    items.map(p => ({ id: p.id, originalName: p.originalName, displayedName: p.displayedName }))

  let items: BaseInterpretedDataType[] = $state(deepCopy(getAllParticipants(engine)))

  const COLUMNS = [
    { label: 'Move', width: '28px', type: 'handle' as const },
    { label: 'Original', width: '1fr', type: 'readonly' as const, key: 'originalName' },
    { label: 'Displayed', width: '1fr', type: 'text' as const, key: 'displayedName' },
  ]

  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]
</script>

<Section>
  <EditableEntityList
    {items}
    title="Participants"
    emptyMessage="No participants found"
    columns={COLUMNS}
    sortColumns={SORT_COLUMNS}
    onSort={(col, dir) => { items = sortItems(items, col, dir) }}
    onReorder={(from, to) => { items = reorderItems(items, from, to) }}
    onItemChange={(id, key, value) => {
      items = items.map(p => p.id === id ? { ...p, [key]: value } : p)
    }}
  >
    {#snippet toolbar()}
      <RenameToolbar
        onRename={(find, replace) => {
          items = items.map(p => ({
            ...p,
            displayedName: p.displayedName.replace(new RegExp(find, 'g'), replace),
          }))
        }}
      />
    {/snippet}
  </EditableEntityList>

  {#if items.length > 0}
    <ModalButtons
      buttons={[
        { label: 'Apply', onclick: () => { if (workspace.updateParticipants(deepCopy(items), source)) modalState.close() }, variant: 'primary' },
        { label: 'Cancel', onclick: () => modalState.close() },
      ]}
    />
  {/if}
</Section>
