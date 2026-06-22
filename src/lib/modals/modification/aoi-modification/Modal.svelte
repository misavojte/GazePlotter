<script lang="ts">
  import Radio from '$lib/shared/components/Radio.svelte'
  import Select from '$lib/shared/components/Select.svelte'
  import { InputColor, InputText } from '$lib/shared/components'
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getAllAois, getHiddenAois } from '$lib/data/engine'
  import { getStimuliOptions } from '$lib/plots/shared'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import { createGroupedEntityEditor } from '../shared/groupedEntityEditor.svelte'

  interface Props {
    selectedStimulus?: string
    userSelected?: string
    source: string
  }

  let {
    selectedStimulus = $bindable('0'),
    userSelected = $bindable('this'),
    source,
  }: Props = $props()
  const { engine, modalState, toastState, workspace } = getGazePlotterSession()

  const editor = createGroupedEntityEditor({
    getItems: stimulusId => getAllAois(engine, stimulusId),
    getHidden: stimulusId => getHiddenAois(engine, stimulusId),
    initialStimulusId: parseInt(selectedStimulus),
  })

  $effect(() => {
    editor.syncStimulus(parseInt(selectedStimulus))
  })

  // --- No AOI treatment ---

  const modificationMeta = engine.metadata
  if (!modificationMeta) throw new Error('Data engine metadata not available')

  let noAoiTreatment = $state({
    displayedName: modificationMeta.noAoiTreatment.displayedName,
    color: modificationMeta.noAoiTreatment.color,
  })
  let lastNoAoiTreatmentSnapshot = $state({
    displayedName: modificationMeta.noAoiTreatment.displayedName,
    color: modificationMeta.noAoiTreatment.color,
  })

  const handleSubmit = () => {
    const handlerTypeMap = {
      this: 'this_stimulus',
      all_original: 'all_by_original_name',
      all_displayed: 'all_by_displayed_name',
    } as const

    const handlerType = handlerTypeMap[userSelected as keyof typeof handlerTypeMap]

    if (!workspace.updateAois(editor.getCleanedItems(), parseInt(selectedStimulus), handlerType, source, editor.getCleanedHiddenIds())) {
      return
    }

    if (
      noAoiTreatment.displayedName !== lastNoAoiTreatmentSnapshot.displayedName ||
      noAoiTreatment.color !== lastNoAoiTreatmentSnapshot.color
    ) {
      const didUpdate = workspace.updateNoAoiTreatment(
        { displayedName: (noAoiTreatment.displayedName || 'No AOI').trim(), color: noAoiTreatment.color },
        source
      )
      if (!didUpdate) return
      lastNoAoiTreatmentSnapshot = { displayedName: noAoiTreatment.displayedName, color: noAoiTreatment.color }
    }

    editor.commitHiddenSnapshot()

    if (handlerType !== 'this_stimulus') {
      toastState.addInfo('Ordering of AOIs is not updated for other stimuli')
    }

    modalState.close()
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

<div class="stimulus-row">
  <Select
    label="For stimulus"
    options={getStimuliOptions(engine)}
    bind:value={selectedStimulus}
  />
</div>

<Section>
  <EditableEntityList
    items={editor.groups}
    title="AOIs"
    emptyMessage="No AOIs found in stimulus"
    columns={COLUMNS}
    sortColumns={SORT_COLUMNS}
    hintText={editor.hasGroups ? undefined : 'Name AOIs the same to <strong>group</strong> them together'}
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

  {#if editor.groups.length > 0}
    <div class="content">
      <Radio
        legend="Apply changes to"
        options={[
          { label: 'This stimulus', value: 'this' },
          { label: 'All by original name', value: 'all_original' },
          { label: 'All by displayed name', value: 'all_displayed' },
        ]}
        bind:value={userSelected}
      />
    </div>
    <div class="content">
      <Section title="No AOI Hit Treatment">
        <div class="noaoi-treatment-container">
          <div class="noaoi-color-wrapper">
            <InputColor label="Color" bind:value={noAoiTreatment.color} />
          </div>
          <div class="noaoi-name-wrapper">
            <InputText
              label="Display name"
              placeholder="No AOI"
              bind:value={noAoiTreatment.displayedName}
              fill={true}
            />
          </div>
        </div>
      </Section>
    </div>
    <ModalButtons
      buttons={[
        { label: 'Apply', onclick: handleSubmit, variant: 'primary' },
        { label: 'Cancel', onclick: () => modalState.close() },
      ]}
    />
  {/if}
</Section>

<style>
  .stimulus-row {
    margin-bottom: 20px;
  }

  .content {
    margin-bottom: 25px;
  }

  .noaoi-treatment-container {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  .noaoi-color-wrapper {
    flex: 0 0 auto;
    min-width: 120px;
  }

  .noaoi-name-wrapper {
    flex: 1;
    max-width: 250px;
  }
</style>
