<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { getStimuli } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import type { BaseInterpretedDataType } from '$lib/data/types'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import { sortItems, reorderItems } from '../shared/sort'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { engine, modalState, workspace } = getGazePlotterSession()

  const deepCopy = (items: BaseInterpretedDataType[]): BaseInterpretedDataType[] =>
    items.map(s => ({ id: s.id, originalName: s.originalName, displayedName: s.displayedName }))

  let items: BaseInterpretedDataType[] = $state(deepCopy(getStimuli(engine)))

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
    title="Stimuli"
    emptyMessage="No stimuli found"
    columns={COLUMNS}
    sortColumns={SORT_COLUMNS}
    onSort={(col, dir) => { items = sortItems(items, col, dir) }}
    onReorder={(from, to) => { items = reorderItems(items, from, to) }}
    onItemChange={(id, key, value) => {
      items = items.map(s => s.id === id ? { ...s, [key]: value } : s)
    }}
    onRename={(find, replace) => {
      items = items.map(s => ({
        ...s,
        displayedName: s.displayedName.replace(new RegExp(find, 'g'), replace),
      }))
    }}
  />

  {#if items.length > 0}
    <ModalButtons
      buttons={[
        { label: 'Apply', onclick: () => { if (workspace.updateStimuli(deepCopy(items), source)) modalState.close() }, variant: 'primary' },
        { label: 'Cancel', onclick: () => modalState.close() },
      ]}
    />
  {/if}
</Section>
