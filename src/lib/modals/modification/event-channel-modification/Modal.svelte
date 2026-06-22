<script lang="ts">
  import Select from '$lib/shared/components/Select.svelte'
  import { Section, ModalButtons } from '$lib/modals'
  import { createEventIntervalsModal } from './definition-steps'
  import { getGazePlotterSession } from '$lib/session'
  import { getEventChannels, getHiddenEventChannels } from '$lib/data/engine'
  import { getStimuliOptions } from '$lib/plots/shared'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import { createGroupedEntityEditor } from '../shared/groupedEntityEditor.svelte'

  interface Props {
    selectedStimulus?: string
    source: string
  }

  let {
    selectedStimulus = $bindable('0'),
    source,
  }: Props = $props()
  const { engine, modalState, workspace } = getGazePlotterSession()

  const editor = createGroupedEntityEditor({
    getItems: stimulusId => getEventChannels(engine, stimulusId),
    getHidden: stimulusId => getHiddenEventChannels(engine, stimulusId),
    initialStimulusId: parseInt(selectedStimulus),
  })

  $effect(() => {
    editor.syncStimulus(parseInt(selectedStimulus))
  })

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
  <Select
    label="For stimulus"
    options={getStimuliOptions(engine)}
    bind:value={selectedStimulus}
  />
</Section>

<Section>
  <EditableEntityList
    items={editor.groups}
    title="Event channels"
    emptyMessage="No event channels found in stimulus"
    columns={COLUMNS}
    sortColumns={SORT_COLUMNS}
    hintText={editor.hasGroups ? undefined : 'Name channels the same to <strong>group</strong> them together'}
    onSort={editor.sort}
    onReorder={editor.reorderGroups}
    onRename={editor.renameAll}
    grouped={{
      hiddenSet: editor.hiddenSet,
      onNameInput: editor.handleNameInput,
      onColorInput: editor.handleColorInput,
      onToggleActive: editor.toggleActive,
    }}
  />

  <ModalButtons
    buttons={[
      ...(editor.groups.length > 0
        ? [
            {
              label: 'Apply',
              onclick: () => {
                if (workspace.updateEventChannels(editor.getCleanedItems(), parseInt(selectedStimulus), source, editor.getCleanedHiddenIds())) {
                  modalState.close()
                }
              },
              variant: 'primary' as const,
            },
          ]
        : []),
      {
        label: 'Create intervals…',
        onclick: () => {
          // Re-pull only when the step actually created intervals (it
          // resolves `true`) — a plain Back must not discard the user's
          // unapplied edits.
          modalState
            .push(createEventIntervalsModal, { source })
            .then(created => {
              if (created) editor.refresh()
            })
        },
      },
      { label: 'Cancel', onclick: () => modalState.close() },
    ]}
  />
</Section>
