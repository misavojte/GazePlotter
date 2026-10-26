<script lang="ts">
  import { untrack } from 'svelte'
  import { Select } from '$lib/shared/components'
  import {
    Step,
    StepList,
    HelpText,
    FieldGrid,
  } from '$lib/modals'
  import type { DecimalSeparator, ExportNaming } from '$lib/data/export'
  import { getGazePlotterSession } from '$lib/session'
  import { getAllCategories, getCategoriesSelections } from '$lib/data/engine'
  import {
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    EXPORT_NAMING_OPTIONS,
    EXPORT_TYPE_OPTIONS,
    csvConventionsSummary,
    exportTypeNamingSummary,
  } from '../shared/helpers'
  import { readExportMemory, rememberExport } from '../shared/exportMemory'
  import ExportShell from '../shared/ExportShell.svelte'
  import StimuliStep from '../shared/StimuliStep.svelte'
  import ParticipantsStep from '../shared/ParticipantsStep.svelte'
  import SelectionStep from '../shared/SelectionStep.svelte'
  import {
    aoiChecklistItems,
    aoiChecklistPresets,
    defaultAoiSelection,
    tickedAoiNames,
  } from '../shared/aois'
  import { defaultStimulusSelection } from '../shared/stimuli'
  import { defaultParticipantSelection } from '../shared/participants'

  export interface Props {
    /** Prefill: one stimulus, and a group's members or one participant. */
    stimulusId?: number
    groupId?: number
    participantId?: number
    /** Prefill: a plot's AOI selection ticks its AOIs. */
    aoiSelectionId?: number
  }

  let { stimulusId, groupId, participantId, aoiSelectionId }: Props = $props()
  const { engine, exportService, workspaceFile } = getGazePlotterSession()
  // Named after the dataset, as the workspace and analysis exports are.
  const fileName = `${workspaceFile.suggestedName}-SegmentedData`
  let exportType = $state('csv')
  const remembered = readExportMemory()
  let delimiter = $state(remembered.delimiter)
  let decimalSeparator = $state<DecimalSeparator>(remembered.decimalSeparator)
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
  
  // Eye-movement types by id, ticked as strings like every checklist step.
  const categoryItems = getAllCategories(engine).map(c => ({
    value: c.id.toString(),
    label: c.displayedName,
    sublabel: c.originalName !== c.displayedName ? `Original: ${c.originalName}` : undefined,
  }))
  const categoryPresets = getCategoriesSelections(engine)
    .filter(s => s.memberIds.length > 0)
    .map(s => ({ id: s.id, name: s.name, members: s.memberIds.map(id => id.toString()) }))
  let selectedCategoryIds = $state(new Set(categoryItems.map(item => item.value)))

  const hasSpatialData = $derived(engine.capabilities.spatial)

  // Unticked AOIs leave the AOI column, as an AOI selection does in a plot.
  // Lists the chosen stimuli's AOIs; ticks span every AOI.
  const aoiItems = $derived(aoiChecklistItems(engine, selectedStimuliIds))
  const aoiPresets = $derived(aoiChecklistPresets(engine, aoiItems))
  let selectedAois = $state(
    untrack(() => defaultAoiSelection(engine, aoiChecklistItems(engine), aoiSelectionId))
  )

  const canExport = $derived(
    selectedStimuliIds.size > 0 &&
      selectedParticipantIds.size > 0 &&
      selectedCategoryIds.size > 0 &&
      (aoiItems.length === 0 || aoiItems.some(item => selectedAois.has(item.value)))
  )
  const fileSummary = $derived(
    [
      ...exportTypeNamingSummary(exportType, naming),
      ...csvConventionsSummary(delimiter, decimalSeparator),
    ].join(' · ')
  )

  const handleExport = () => {
    rememberExport({ delimiter, decimalSeparator })
    return exportService.exportSegmentedData({
      fileName,
      exportType: exportType as 'csv' | 'individual-csv',
      stimulusIds: selectedStimuliIds,
      participantIds: selectedParticipantIds,
      filterCategoryIds: new Set(Array.from(selectedCategoryIds, Number)),
      keepAoiNames: tickedAoiNames(aoiItems, selectedAois),
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

    <SelectionStep
      n={3}
      title="Choose eye-movement types"
      listTitle="Eye-movement types"
      noun="eye-movement type"
      description="Only segments of the ticked types go into the file."
      items={categoryItems}
      presets={categoryPresets}
      bind:selected={selectedCategoryIds}
    />

    {#if aoiItems.length > 0}
      <SelectionStep
        n={4}
        title="Choose AOIs"
        listTitle="AOIs"
        noun="AOI"
        description="Every segment stays in the file; unticked AOIs are left out of its AOI column, so a segment only on them reads as no AOI."
        items={aoiItems}
        presets={aoiPresets}
        bind:selected={selectedAois}
      />
    {/if}

    <Step
      n={aoiItems.length > 0 ? 5 : 4}
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
