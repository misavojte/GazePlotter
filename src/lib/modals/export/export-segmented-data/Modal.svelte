<script lang="ts">
  import { untrack } from 'svelte'
  import { Select } from '$lib/shared/components'
  import {
    CheckboxListField,
    Step,
    StepList,
    HelpText,
    FieldGrid,
  } from '$lib/modals'
  import type { DecimalSeparator, ExportNaming } from '$lib/data/export'
  import { getGazePlotterSession } from '$lib/session'
  import { getAllCategories } from '$lib/data/engine'
  import {
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    EXPORT_NAMING_OPTIONS,
    EXPORT_TYPE_OPTIONS,
    csvConventionsSummary,
    exportTypeNamingSummary,
    lastCsvConventions,
    listSummary,
    toggleSetValue,
  } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'
  import StimuliStep from '../shared/StimuliStep.svelte'
  import ParticipantsStep from '../shared/ParticipantsStep.svelte'
  import { defaultStimulusSelection } from '../shared/stimuli'
  import { defaultParticipantSelection } from '../shared/participants'

  export interface Props {
    /** Prefill: one stimulus, and a group's members or one participant. */
    stimulusId?: number
    groupId?: number
    participantId?: number
  }

  let { stimulusId, groupId, participantId }: Props = $props()
  const { engine, exportService, workspaceFile } = getGazePlotterSession()
  // Named after the dataset, as the workspace and analysis exports are.
  const fileName = `${workspaceFile.suggestedName}-SegmentedData`
  let exportType = $state('csv')
  let delimiter = $state(lastCsvConventions.delimiter)
  let decimalSeparator = $state<DecimalSeparator>(lastCsvConventions.decimalSeparator)
  let naming = $state<ExportNaming>('displayed')
  // Prefill props seed the selection once; they don't bind it.
  let selectedStimuliIds = $state(
    untrack(() => defaultStimulusSelection(engine, stimulusId))
  )
  let selectedParticipantIds = $state(
    untrack(() =>
      participantId != null
        ? new Set([participantId.toString()])
        : defaultParticipantSelection(engine, groupId)
    )
  )
  
  const allCategories = getAllCategories(engine)
  let selectedCategoryIds = $state<Set<number>>(new Set(allCategories.map(c => c.id)))

  const hasSpatialData = $derived(engine.capabilities.spatial)

  const stepCategoriesDone = $derived(selectedCategoryIds.size > 0)
  const canExport = $derived(
    selectedStimuliIds.size > 0 && selectedParticipantIds.size > 0 && stepCategoriesDone
  )

  const categoriesSummary = $derived(
    listSummary(
      selectedCategoryIds.size,
      allCategories.length,
      allCategories.find(c => selectedCategoryIds.has(c.id))?.displayedName
    )
  )
  const fileSummary = $derived(
    [
      ...exportTypeNamingSummary(exportType, naming),
      ...csvConventionsSummary(delimiter, decimalSeparator),
    ].join(' · ')
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

  const handleExport = () => {
    Object.assign(lastCsvConventions, { delimiter, decimalSeparator })
    return exportService.exportSegmentedData({
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
  }
</script>

<ExportShell
  intro="Export eye-tracking segments with timing, movement classifications, and AOI information."
  {canExport}
  exportLabel="Export Segments"
  onExport={handleExport}
>
  <StepList>
    <StimuliStep
      n={1}
      description="Each selected stimulus contributes its segments to the export."
      bind:selected={selectedStimuliIds}
    />
    <ParticipantsStep n={2} bind:selected={selectedParticipantIds} />

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
          Individual files leave out stimulus and participant; each is named
          &lt;stimulus&gt;_&lt;participant&gt;.
        </HelpText>
      {:else}
        <HelpText>
          CSV columns: stimulus, participant, timestamp, duration,
          eyemovementtype, AOI. Load spatially annotated data to unlock x/y
          coordinate export for each segment. Individual files leave out
          stimulus and participant; each is named &lt;stimulus&gt;_&lt;participant&gt;.
        </HelpText>
      {/if}
      <HelpText>
        Naming: "Displayed" uses your renamed movement-type and AOI names and
        merges AOIs grouped under the same name (the on-screen result). "Raw"
        uses the original imported names with no grouping and lists every AOI
        a segment references. The AOI column contains semicolon-separated area
        names.
      </HelpText>
    </Step>
  </StepList>
</ExportShell>
