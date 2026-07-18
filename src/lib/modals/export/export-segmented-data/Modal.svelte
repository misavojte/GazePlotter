<script lang="ts">
  import { Select } from '$lib/shared/components'
  import {
    CheckboxListField,
    ModalButtons,
    Step,
    StepList,
    HelpText,
    FieldGrid,
  } from '$lib/modals'
  import type { DecimalSeparator, ExportNaming } from '$lib/data/export'
  import { getGazePlotterSession } from '$lib/session'
  import { getAllCategories } from '$lib/data/engine'
  import {
    createExportButtons,
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    EXPORT_NAMING_OPTIONS,
    EXPORT_TYPE_OPTIONS,
    exportTypeNamingSummary,
    waitForExportUi,
    listSummary,
    toggleSetValue,
  } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'
  import ExportProgressBar from '../shared/ExportProgressBar.svelte'
  import StimuliSelect from '../shared/StimuliSelect.svelte'
  import ParticipantsSelect from '../shared/ParticipantsSelect.svelte'
  import { defaultStimulusSelection, stimuliSelectionSummary } from '../shared/stimuli'
  import {
    defaultParticipantSelection,
    participantsSelectionSummary,
  } from '../shared/participants'

  const { engine, exportService, modalState } = getGazePlotterSession()
  const fileName = 'GazePlotter-SegmentedData'
  let exportType = $state('csv')
  let delimiter = $state(',')
  let decimalSeparator = $state<DecimalSeparator>('.')
  let naming = $state<ExportNaming>('displayed')
  let selectedStimuliIds = $state(defaultStimulusSelection(engine))
  let selectedParticipantIds = $state(defaultParticipantSelection(engine))
  
  const allCategories = getAllCategories(engine)
  let selectedCategoryIds = $state<Set<number>>(new Set(allCategories.map(c => c.id)))

  let isExporting = $state(false)

  const hasSpatialData = $derived(engine.capabilities.spatial)

  const stepStimuliDone = $derived(selectedStimuliIds.size > 0)
  const stepParticipantsDone = $derived(selectedParticipantIds.size > 0)
  const stepCategoriesDone = $derived(selectedCategoryIds.size > 0)
  const canExport = $derived(stepStimuliDone && stepParticipantsDone && stepCategoriesDone)

  const stimuliSummary = $derived(
    stimuliSelectionSummary(engine, selectedStimuliIds)
  )
  const participantsSummary = $derived(
    participantsSelectionSummary(engine, selectedParticipantIds)
  )
  const categoriesSummary = $derived(
    listSummary(
      selectedCategoryIds.size,
      allCategories.length,
      allCategories.find(c => selectedCategoryIds.has(c.id))?.displayedName
    )
  )
  const fileSummary = $derived(
    exportTypeNamingSummary(exportType, naming).join(' · ')
  )

  const categoryItems = $derived(
    allCategories.map(c => ({
      key: c.id.toString(),
      label: c.displayedName,
      sublabel: c.originalName !== c.displayedName ? `Original: ${c.originalName}` : undefined,
      checked: selectedCategoryIds.has(c.id),
    }))
  )

  function handleCategoryChange(key: string, checked: boolean) {
    selectedCategoryIds = toggleSetValue(selectedCategoryIds, parseInt(key, 10), checked)
  }

  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      await waitForExportUi()
      await exportService.exportSegmentedData({
        fileName,
        exportType: exportType as 'csv' | 'individual-csv',
        stimulusIds: selectedStimuliIds,
        participantIds: selectedParticipantIds,
        filterCategoryIds: selectedCategoryIds,
        naming,
        csvOptions: {
          delimiter,
          decimalSeparator,
        },
      })
    } finally {
      isExporting = false
    }
  }

  const exportButtons = $derived(
    createExportButtons({
      canExport,
      exportLabel: 'Export Data',
      isExporting,
      onCancel: () => modalState.close(),
      onExport: handleExport,
    })
  )
</script>

<ExportShell
  intro="Export eye-tracking segments with timing, movement classifications, and AOI information."
>
  <StepList>
    <Step
      n={1}
      title="Choose stimuli"
      description="Each selected stimulus contributes its segments to the export."
      summary={stimuliSummary}
      done={stepStimuliDone}
    >
      <StimuliSelect
        selected={selectedStimuliIds}
        onchange={next => (selectedStimuliIds = next)}
        hasError={!stepStimuliDone}
      />
    </Step>

    <Step
      n={2}
      title="Choose participants"
      description="Selection chips toggle a whole participant selection at once; individual checkmarks refine the result."
      summary={participantsSummary}
      done={stepParticipantsDone}
    >
      <ParticipantsSelect
        selected={selectedParticipantIds}
        onchange={next => (selectedParticipantIds = next)}
        hasError={!stepParticipantsDone}
      />
    </Step>

    <Step
      n={3}
      title="Choose eye-movement types"
      description="Select which eye-movement categories to include in the exported file."
      summary={categoriesSummary}
      done={stepCategoriesDone}
    >
      <CheckboxListField
        title="Eye-movement types"
        items={categoryItems}
        onItemChange={handleCategoryChange}
        hasError={!stepCategoriesDone}
        errorMessage="Select at least one eye-movement type to export"
      />
    </Step>

    <Step
      n={4}
      title="Configure the file"
      description="The file layout and CSV conventions."
      summary={fileSummary}
      done={true}
      last
    >
      <FieldGrid>
        <Select
          label="Export Type"
          options={EXPORT_TYPE_OPTIONS}
          bind:value={exportType}
        />
        <Select
          label="Delimiter"
          options={CSV_DELIMITER_OPTIONS}
          bind:value={delimiter}
        />
        <Select
          label="Decimal Separator"
          options={CSV_DECIMAL_SEPARATOR_OPTIONS}
          bind:value={decimalSeparator}
        />
        <Select
          label="Naming"
          options={EXPORT_NAMING_OPTIONS}
          bind:value={naming}
        />
      </FieldGrid>
      {#if hasSpatialData}
        <HelpText>
          CSV columns: stimulus, participant, timestamp, duration,
          eyemovementtype, AOI, x, y. Spatial coordinates are exported per
          segment; segments without coordinates keep empty x/y fields.
        </HelpText>
      {:else}
        <HelpText>
          CSV columns: stimulus, participant, timestamp, duration,
          eyemovementtype, AOI. Load spatially annotated data to unlock x/y
          coordinate export for each segment.
        </HelpText>
      {/if}
      <HelpText>
        Naming: "Displayed" uses your renamed movement-type and AOI names,
        merges AOIs grouped under the same name, and excludes hidden AOIs (the
        on-screen result). "Raw" uses the original imported names with no
        grouping and lists every AOI a segment references, including hidden
        ones. The AOI column contains semicolon-separated area names.
      </HelpText>
    </Step>
  </StepList>

  <ExportProgressBar progress={exportService.progress} />

  <ModalButtons buttons={exportButtons} />
</ExportShell>
