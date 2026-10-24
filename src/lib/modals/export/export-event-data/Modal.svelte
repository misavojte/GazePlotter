<script lang="ts">
  import { Select } from '$lib/shared/components'
  import { Step, StepList, HelpText, FieldGrid } from '$lib/modals'
  import type { DecimalSeparator, ExportNaming } from '$lib/data/export'
  import { getGazePlotterSession } from '$lib/session'
  import {
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    EXPORT_NAMING_OPTIONS,
    EXPORT_TYPE_OPTIONS,
    exportTypeNamingSummary,
  } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'
  import StimuliStep from '../shared/StimuliStep.svelte'
  import ParticipantsStep from '../shared/ParticipantsStep.svelte'
  import { defaultStimulusSelection } from '../shared/stimuli'
  import { defaultParticipantSelection } from '../shared/participants'

  const { engine, exportService, workspaceFile } = getGazePlotterSession()

  // Named after the dataset, as the workspace and analysis exports are.
  const fileName = `${workspaceFile.suggestedName}-EventData`
  let exportType = $state('csv')
  let naming = $state<ExportNaming>('displayed')
  let delimiter = $state(',')
  let decimalSeparator = $state<DecimalSeparator>('.')
  let selectedStimuliIds = $state(defaultStimulusSelection(engine))
  let selectedParticipantIds = $state(defaultParticipantSelection(engine))

  const canExport = $derived(
    selectedStimuliIds.size > 0 && selectedParticipantIds.size > 0
  )
  const fileSummary = $derived(
    exportTypeNamingSummary(exportType, naming).join(' · ')
  )

  const handleExport = () =>
    exportService.exportEventData({
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
</script>

<ExportShell
  intro="Export event occurrences with their timing per participant and stimulus."
  {canExport}
  exportLabel="Export Events"
  onExport={handleExport}
>
  <StepList>
    <StimuliStep
      n={1}
      description="Each selected stimulus contributes its event occurrences to the export."
      bind:selected={selectedStimuliIds}
    />
    <ParticipantsStep n={2} bind:selected={selectedParticipantIds} />

    <Step
      n={3}
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
      <HelpText>
        CSV columns: stimulus, participant, eventName, start, duration. Times
        are in milliseconds; a duration of 0 marks an instant event. A
        single-file export can be re-imported as an event file alongside its
        eye-tracking data.
      </HelpText>
      <HelpText>
        Naming: "Displayed" uses your renamed event names, merges channels
        grouped under the same name, and includes derived interval channels
        (the on-screen result). "Raw" uses the
        original imported channel names with no grouping and excludes derived
        interval channels.
      </HelpText>
    </Step>
  </StepList>
</ExportShell>
