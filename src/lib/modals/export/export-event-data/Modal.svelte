<script lang="ts">
  import { InputText, Select } from '$lib/shared/components'
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
  let fileName = $state('GazePlotter-EventData')
  let exportType = $state('csv')
  let delimiter = $state(',')
  let decimalSeparator = $state<DecimalSeparator>('.')
  let naming = $state<ExportNaming>('displayed')
  let selectedStimuliIds = $state(defaultStimulusSelection(engine))
  let selectedParticipantIds = $state(defaultParticipantSelection(engine))
  let isExporting = $state(false)

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
    exportTypeNamingSummary(exportType, naming).join(' · ')
  )

  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      await waitForExportUi()
      await exportService.exportEventData({
        fileName,
        exportType: exportType as 'csv' | 'individual-csv',
        stimulusIds: selectedStimuliIds,
        participantIds: selectedParticipantIds,
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
  intro="Export event occurrences with their timing per participant and stimulus."
>
  <StepList>
    <Step
      n={1}
      title="Choose stimuli"
      description="Each selected stimulus contributes its event occurrences to the export."
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
      description="The file layout and CSV conventions."
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
      <HelpText>
        CSV columns: stimulus, participant, eventName, start, duration. Times
        are in milliseconds; a duration of 0 marks an instant event. A
        single-file export can be re-imported as an event file alongside its
        eye-tracking data.
      </HelpText>
      <HelpText>
        Naming: "Displayed" uses your renamed event names, merges channels
        grouped under the same name, hides hidden channels, and includes
        derived interval channels (the on-screen result). "Raw" uses the
        original imported channel names with no grouping and excludes derived
        interval channels.
      </HelpText>
    </Step>
  </StepList>

  <ModalButtons buttons={exportButtons} />
</ExportShell>
