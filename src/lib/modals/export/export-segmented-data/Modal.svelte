<script lang="ts">
  import { InputText, InputCheck, Select } from '$lib/shared/components'
  import { ModalButtons, Step, StepList, HelpText, FieldGrid } from '$lib/modals'
  import type { DecimalSeparator, ExportNaming } from '$lib/data/export'
  import { getGazePlotterSession } from '$lib/session'
  import {
    createExportButtons,
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    EXPORT_NAMING_OPTIONS,
    EXPORT_TYPE_OPTIONS,
    exportTypeNamingSummary,
    waitForExportUi,
  } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'
  import StimuliSelect from '../shared/StimuliSelect.svelte'
  import ParticipantsSelect from '../shared/ParticipantsSelect.svelte'
  import { defaultStimulusSelection, stimuliSelectionSummary } from '../shared/stimuli'
  import {
    defaultParticipantSelection,
    participantsSelectionSummary,
  } from '../shared/participants'

  const { engine, exportService, modalState } = getGazePlotterSession()
  let fileName = $state('GazePlotter-SegmentedData')
  let exportType = $state('csv')
  let delimiter = $state(',')
  let decimalSeparator = $state<DecimalSeparator>('.')
  let naming = $state<ExportNaming>('displayed')
  let exportFixationsOnly = $state(false)
  let selectedStimuliIds = $state(defaultStimulusSelection(engine))
  let selectedParticipantIds = $state(defaultParticipantSelection(engine))
  let isExporting = $state(false)

  const hasSpatialData = $derived(engine.capabilities.spatial)

  const stepStimuliDone = $derived(selectedStimuliIds.size > 0)
  const stepParticipantsDone = $derived(selectedParticipantIds.size > 0)
  const stepFileDone = $derived(fileName.trim().length > 0)
  const canExport = $derived(
    stepStimuliDone && stepParticipantsDone && stepFileDone
  )

  const stimuliSummary = $derived(
    stimuliSelectionSummary(engine, selectedStimuliIds)
  )
  const participantsSummary = $derived(
    participantsSelectionSummary(engine, selectedParticipantIds)
  )
  const fileSummary = $derived(
    [
      ...exportTypeNamingSummary(exportType, naming),
      ...(exportFixationsOnly ? ['fixations only'] : []),
    ].join(' · ')
  )

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
        filterFixations: exportFixationsOnly,
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
      description="Group chips toggle a whole participant group at once; individual checkmarks refine the result."
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
      title="Configure the file"
      description="The file layout, CSV conventions, and segment filters."
      summary={fileSummary}
      done={stepFileDone}
      last
    >
      <FieldGrid>
        <Select
          label="Export Type"
          options={EXPORT_TYPE_OPTIONS}
          bind:value={exportType}
        />
        <InputText
          label="File name"
          bind:value={fileName}
          placeholder="Enter filename without extension"
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
      <InputCheck
        label="Export only fixations"
        sublabel="Excludes saccades and other movement types from the file."
        bind:checked={exportFixationsOnly}
      />
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

  <ModalButtons buttons={exportButtons} />
</ExportShell>
