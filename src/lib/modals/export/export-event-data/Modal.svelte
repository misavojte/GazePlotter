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
    csvConventionsSummary,
    exportTypeNamingSummary,
    lastCsvConventions,
  } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'
  import StimuliStep from '../shared/StimuliStep.svelte'
  import ParticipantsStep from '../shared/ParticipantsStep.svelte'
  import SelectionStep from '../shared/SelectionStep.svelte'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { getEventChannels, getEventsSelections } from '$lib/data/engine'
  import { defaultStimulusSelection } from '../shared/stimuli'
  import { defaultParticipantSelection } from '../shared/participants'

  const { engine, exportService, workspaceFile } = getGazePlotterSession()

  // Named after the dataset, as the workspace and analysis exports are.
  const fileName = `${workspaceFile.suggestedName}-EventData`
  let exportType = $state('csv')
  let naming = $state<ExportNaming>('displayed')
  let delimiter = $state(lastCsvConventions.delimiter)
  let decimalSeparator = $state<DecimalSeparator>(lastCsvConventions.decimalSeparator)
  let selectedStimuliIds = $state(defaultStimulusSelection(engine))
  let selectedParticipantIds = $state(defaultParticipantSelection(engine))

  // Channels by displayed name across the visible stimuli, in first-seen
  // order: the same displayed name is the same channel everywhere.
  const channelItems = (() => {
    const names = new Set<string>()
    for (const { value } of getStimuliOptions(engine)) {
      for (const channel of getEventChannels(engine, Number(value))) {
        names.add(channel.displayedName)
      }
    }
    return Array.from(names, name => ({ value: name, label: name }))
  })()
  // Event selections hold displayed names; a chip covers the ones present here.
  const channelPresets = getEventsSelections(engine)
    .map(s => ({
      id: s.id,
      name: s.name,
      members: s.names.filter(name => channelItems.some(item => item.value === name)),
    }))
    .filter(preset => preset.members.length > 0)
  let selectedChannels = $state(new Set(channelItems.map(item => item.value)))

  const canExport = $derived(
    selectedStimuliIds.size > 0 &&
      selectedParticipantIds.size > 0 &&
      selectedChannels.size > 0
  )
  const fileSummary = $derived(
    [
      ...exportTypeNamingSummary(exportType, naming),
      ...csvConventionsSummary(delimiter, decimalSeparator),
    ].join(' · ')
  )

  const handleExport = () => {
    Object.assign(lastCsvConventions, { delimiter, decimalSeparator })
    return exportService.exportEventData({
      fileName,
      exportType: exportType as 'csv' | 'individual-csv',
      stimulusIds: selectedStimuliIds,
      participantIds: selectedParticipantIds,
      // Every channel ticked = no filter, byte-identical to the export before.
      channelNames:
        selectedChannels.size === channelItems.length ? undefined : selectedChannels,
      naming,
      csvOptions: {
        delimiter,
        decimalSeparator,
      },
    })
  }
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
    <SelectionStep
      n={3}
      title="Choose event channels"
      listTitle="Event channels"
      noun="event channel"
      description="Only occurrences of the ticked channels go into the file."
      items={channelItems}
      presets={channelPresets}
      bind:selected={selectedChannels}
    />

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
      <HelpText>
        CSV columns: stimulus, participant, eventName, start, duration. Times
        are in milliseconds; a duration of 0 marks an instant event.
        Individual files leave out stimulus and participant; each is named
        &lt;stimulus&gt;_&lt;participant&gt;. A
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
