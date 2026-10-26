<script lang="ts">
  import { untrack } from 'svelte'
  import { Select, InputText, InputCheck } from '$lib/shared/components'
  import {
    CheckboxListField,
    Step,
    StepList,
    HelpText,
    FieldGrid,
  } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import {
    METRIC_EXPORT_CONTRACT_LONG,
    METRIC_EXPORT_CONTRACT_WIDE,
    deduplicateMetricLabels,
    longFormatMetricColumns,
  } from '$lib/data/export/mappers/metrics'
  import {
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    csvConventionsSummary,
    listSummary,
    mapSelectableItems,
    toggleSetValue,
  } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'
  import { readExportMemory, rememberExport } from '../shared/exportMemory'
  import StimuliStep from '../shared/StimuliStep.svelte'
  import ParticipantsStep from '../shared/ParticipantsStep.svelte'
  import { defaultStimulusSelection } from '../shared/stimuli'
  import {
    defaultParticipantSelection,
    orderedSelectedParticipantIds,
  } from '../shared/participants'
  import {
    instanceMatchesContract,
    datasetCanFeed,
    instanceReadout,
    formatProjectionReadout,
    getMetric,
    projectionOutputShape,
    defaultInstanceLabel,
  } from '$lib/metrics'
  import { aoiModificationModal, metricLibraryModal } from '../../definitions'
  import SelectionStep from '../shared/SelectionStep.svelte'
  import {
    aoiChecklistItems,
    aoiChecklistPresets,
    defaultAoiSelection,
    tickedAoiNames,
  } from '../shared/aois'
  import { multiSelectMetricHandlers } from '$lib/plots/shared/metricInstanceHandlers'

  export interface Props {
    /** Prefill: preselect this participant group's members. */
    groupId?: number
    stimulusId?: number
    metricInstanceIds?: string[]
    /** Prefill: a plot's crop, in ms; 0 or unset = open-ended. */
    timeStart?: number
    timeEnd?: number
    /** Prefill: a plot's AOI selection; 0 or unset = all AOIs. */
    aoiSelectionId?: number
    /** Prefill: a plot's Hide No AOI toggle. */
    hideNoAoi?: boolean
  }

  let {
    groupId,
    stimulusId,
    metricInstanceIds,
    timeStart: presetStart,
    timeEnd: presetEnd,
    aoiSelectionId: presetAoiSelection,
    hideNoAoi: presetHideNoAoi,
  }: Props = $props()
  const { exportService, modalState, engine, workspace, workspaceFile } =
    getGazePlotterSession()

  const remembered = readExportMemory()
  // The last export's format, unless a plot's metrics need the long one: the
  // file then still holds everything the plot shows.
  let format = $state<'long' | 'wide'>(
    untrack(() =>
      remembered.metricFormat === 'wide' &&
      (metricInstanceIds ?? []).every(id => {
        const inst = engine.metadata?.metricInstances.find(m => m.id === id)
        return !!inst && instanceMatchesContract(inst, METRIC_EXPORT_CONTRACT_WIDE, engine.capabilities)
      })
        ? 'wide'
        : 'long'
    )
  )
  // Named after the dataset, as the workspace and analysis exports are.
  const fileName = `${workspaceFile.suggestedName}-MetricData`
  let delimiter = $state(remembered.delimiter)
  let decimalSeparator = $state<'.' | ','>(remembered.decimalSeparator)
  let includeCodebook = $state(remembered.includeCodebook)
  const presetTime = (ms: number | undefined) => (ms ? String(ms) : '')
  let timeStartStr = $state(untrack(() => presetTime(presetStart)))
  let timeEndStr = $state(untrack(() => presetTime(presetEnd)))

  // Prefill props are read once by design (untrack): they seed the selection,
  // they don't bind it.
  let selectedStimuliIds = $state(
    untrack(() => defaultStimulusSelection(engine, stimulusId))
  )

  // Computed as a plot computes it: unticked AOIs count as No AOI. Lists the
  // chosen stimuli's AOIs; live, so AOI library edits show up on return.
  // Ticks span every AOI, so unticking a stimulus doesn't lose them.
  const aoiItems = $derived(aoiChecklistItems(engine, selectedStimuliIds))
  const aoiPresets = $derived(aoiChecklistPresets(engine, aoiItems))
  let selectedAois = $state(
    untrack(() => defaultAoiSelection(engine, aoiChecklistItems(engine), presetAoiSelection))
  )
  let includeNoAoi = $state(untrack(() => !presetHideNoAoi))
  let selectedParticipantIds = $state(
    untrack(() => defaultParticipantSelection(engine, groupId))
  )

  const activeContract = $derived(
    format === 'long' ? METRIC_EXPORT_CONTRACT_LONG : METRIC_EXPORT_CONTRACT_WIDE
  )

  const instancesById = $derived(
    new Map((engine.metadata?.metricInstances ?? []).map(inst => [inst.id, inst]))
  )

  // ── Metrics ────────────────────────────────────────────────────────────────
  let selectedMetrics = $state(
    (() => {
      const allInstances = engine.metadata?.metricInstances ?? []
      if (metricInstanceIds && metricInstanceIds.length > 0) {
        return new Set<string>(metricInstanceIds)
      }
      const initialChecked = allInstances.filter(inst =>
        instanceMatchesContract(inst, activeContract, engine.capabilities) &&
        inst.projection.kind !== 'windowed'
      )
      return new Set<string>(initialChecked.map(m => m.id))
    })()
  )

  // Invariant: the checked set IS the exported set. Format switches prune
  // incompatible selections (handleFormatChange, disclosed via prunedNotice);
  // this filter only covers instances deleted from the library while the
  // modal is open.
  const activeSelectedMetrics = $derived(
    Array.from(selectedMetrics).filter(id => {
      const inst = instancesById.get(id)
      return inst && instanceMatchesContract(inst, activeContract, engine.capabilities)
    })
  )

  /** Selected instances in selection order — the exact list the mapper will
   *  receive, so previews computed from it always match the file. */
  const selectedInstancesInOrder = $derived(
    activeSelectedMetrics
      .map(id => instancesById.get(id))
      .filter((inst): inst is NonNullable<typeof inst> => !!inst)
  )

  const previewLabels = $derived(deduplicateMetricLabels(selectedInstancesInOrder))

  const hasWindowedSelected = $derived(
    selectedInstancesInOrder.some(inst => inst.projection.kind === 'windowed')
  )

  /** Set when a format switch deselected incompatible metrics — the pruning
   *  must never be silent. Cleared on the next metric interaction. */
  let prunedNotice = $state('')

  function handleFormatChange(next: 'long' | 'wide') {
    const nextContract =
      next === 'long' ? METRIC_EXPORT_CONTRACT_LONG : METRIC_EXPORT_CONTRACT_WIDE
    const pruned = Array.from(selectedMetrics).filter(id => {
      const inst = instancesById.get(id)
      return inst && instanceMatchesContract(inst, nextContract, engine.capabilities)
    })
    const dropped = selectedMetrics.size - pruned.length
    prunedNotice =
      dropped > 0
        ? `${dropped} selected ${dropped === 1 ? 'metric is' : 'metrics are'} not available in this format and ${dropped === 1 ? 'was' : 'were'} deselected.`
        : ''
    if (dropped > 0) {
      selectedMetrics = new Set(pruned)
    }
  }

  // Instances the dataset can feed at all; capability-missing ones (e.g. event
  // metrics without event data) are hidden, not shown disabled — the same rule
  // as every picker, and the disabled `reason` strings stay format-specific.
  const capableInstances = $derived(
    (engine.metadata?.metricInstances ?? []).filter(inst =>
      datasetCanFeed(inst, engine.capabilities)
    )
  )

  const metricsItems = $derived(
    mapSelectableItems(
      capableInstances.map(inst => {
        const label = inst.label || defaultInstanceLabel(inst.baseId)
        const readoutChips = instanceReadout(inst, { includeReduction: false })
        const projReadout = formatProjectionReadout(inst)
        if (projReadout) readoutChips.push(projReadout)
        const m = getMetric(inst.baseId)
        if (m?.meta.unit) readoutChips.push(m.meta.unit)

        const sublabel = readoutChips.join(' · ')
        const matches = instanceMatchesContract(inst, activeContract, engine.capabilities)

        let reason = ''
        if (!matches) {
          reason =
            inst.projection.kind === 'windowed'
              ? 'Time series, available in the long format'
              : 'Not exportable as CSV in either format'
        }

        return {
          value: inst.id,
          label,
          sublabel,
          disabled: !matches,
          reason,
        }
      }),
      selectedMetrics
    )
  )

  function handleMetricChange(key: string, checked: boolean) {
    prunedNotice = ''
    selectedMetrics = toggleSetValue(selectedMetrics, key, checked)
  }

  // ── Collapsed-header selection summaries (the at-a-glance readouts) ────────
  const metricsSummary = $derived.by(() => {
    const total = capableInstances.length
    const count = activeSelectedMetrics.length
    const single =
      count === 1 ? instancesById.get(activeSelectedMetrics[0])?.label : undefined
    return listSummary(count, total, single)
  })

  const fileSummary = $derived.by(() => {
    const parts = [
      format === 'long' ? 'Long (tidy)' : 'Wide',
      includeCodebook ? 'CSV + codebook' : 'CSV',
      ...csvConventionsSummary(delimiter, decimalSeparator),
    ]
    if (timeStartStr.trim() !== '' || timeEndStr.trim() !== '') parts.push('cropped time range')
    return parts.join(' · ')
  })

  // ── Format / file settings ─────────────────────────────────────────────────
  const formatOptions = [
    { value: 'long', label: 'Long (tidy)' },
    { value: 'wide', label: 'Wide' },
  ]

  const formatHelp = $derived(
    format === 'long'
      ? 'One row per observation. Best for R, Python, JASP, and jamovi.'
      : 'One row per participant and stimulus, one column per metric and AOI. Best for SPSS.'
  )

  const formatDetailsText = $derived.by(() => {
    if (selectedInstancesInOrder.length === 0) {
      return 'No metrics selected.'
    }
    if (format === 'long') {
      const { header } = longFormatMetricColumns(selectedInstancesInOrder)
      return `Long format CSV with columns: ${header.join(', ')}.`
    } else {
      const columns = ['Participant_ID', 'Participant', 'Stimulus']
      const instNames: string[] = []
      for (const inst of selectedInstancesInOrder) {
        // Whitespace becomes '_' as in the exporter's header names
        // (KEEP IN SYNC with sanitizeColumnName in mappers/metrics.ts).
        const label = (previewLabels.get(inst.id) ?? inst.label).replace(/\s+/g, '_')
        const shape = projectionOutputShape(inst.projection)
        if (shape === 'scalar') {
          instNames.push(label)
        } else if (shape === 'aoi-vector') {
          instNames.push(`${label}_<AOI>`)
        } else if (shape === 'aoi-pair-matrix') {
          instNames.push(`${label}_<From>_to_<To>`)
        } else if (shape === 'participant-pair-matrix') {
          instNames.push(`${label}_<Participant>`)
        }
      }
      return `Wide format CSV (one row per participant × stimulus case) with columns: ${columns.join(', ')}, followed by value columns: ${instNames.join(', ')}.`
    }
  })

  // Number() (not parseInt) so trailing garbage is rejected, not truncated:
  // '5s' must be an error, never a silent 5.
  const timeStart = $derived(timeStartStr.trim() === '' ? undefined : Number(timeStartStr))
  const timeEnd = $derived(timeEndStr.trim() === '' ? undefined : Number(timeEndStr))

  const timeRangeError = $derived.by(() => {
    const invalid = (v: number | undefined) =>
      v !== undefined && (!Number.isFinite(v) || v < 0)
    // Name the field and echo what was typed: a unit slip ("5s") is the usual cause.
    if (invalid(timeStart)) {
      return `Time Start "${timeStartStr.trim()}" is not a non-negative number of milliseconds`
    }
    if (invalid(timeEnd)) {
      return `Time End "${timeEndStr.trim()}" is not a non-negative number of milliseconds`
    }
    if (timeEnd !== undefined && timeEnd <= (timeStart ?? 0)) {
      return 'Time end must be greater than time start'
    }
    return null
  })

  // ── Step completion: the badge turns into a check when its step is valid ───
  const stepMetricsDone = $derived(activeSelectedMetrics.length > 0)
  const stepFileDone = $derived(timeRangeError === null)

  const canExport = $derived(
    stepMetricsDone &&
      selectedStimuliIds.size > 0 &&
      selectedParticipantIds.size > 0 &&
      (aoiItems.length === 0 || aoiItems.some(item => selectedAois.has(item.value))) &&
      stepFileDone
  )

  const handleExport = () => {
    rememberExport({ delimiter, decimalSeparator, metricFormat: format, includeCodebook })
    return exportService.exportMetricData({
      fileName,
      // Engine order, not click order, so rows are stable across exports.
      participantIds: orderedSelectedParticipantIds(engine, selectedParticipantIds),
      stimulusIds: Array.from(selectedStimuliIds).map(id => parseInt(id)),
      metricInstanceIds: activeSelectedMetrics,
      format,
      csvOptions: {
        delimiter,
        decimalSeparator,
      },
      includeCodebook,
      timeStart,
      timeEnd,
      aoiNames: tickedAoiNames(aoiItems, selectedAois),
      hideNoAoi: aoiItems.length > 0 && !includeNoAoi,
    })
  }

  const handleEditAois = () => {
    modalState.push(aoiModificationModal, {
      source: 'exportMetricData.modal',
      selectedStimulus: Array.from(selectedStimuliIds)[0],
    })
  }

  const handleEditLibrary = () => {
    const handlers = multiSelectMetricHandlers(
      engine,
      workspace,
      () => Array.from(selectedMetrics),
      (ids) => {
        selectedMetrics = new Set(ids)
      }
    )
    modalState.push(metricLibraryModal, {
      contract: activeContract,
      ...handlers,
    })
  }
</script>

<ExportShell
  intro="Export eye-tracking metrics from the library, computed per participant and stimulus."
  {canExport}
  exportLabel="Export Metrics"
  onExport={handleExport}
>
  <StepList>
    <Step
      n={1}
      title="Choose metrics"
      summary={metricsSummary}
      done={stepMetricsDone}
    >
      <HelpText>
        The list mirrors the workspace
        <button type="button" class="inline-link" onclick={handleEditLibrary}>metric library</button>;
        values are computed per participant, exactly as configured. Open the
        library to define further metrics with different parameters,
        projections, or aggregations.
      </HelpText>
      <CheckboxListField
        title="Metrics"
        items={metricsItems}
        onItemChange={handleMetricChange}
        hasError={!stepMetricsDone}
        errorMessage="Select at least one metric to export"
      />
    </Step>

    <StimuliStep
      n={2}
      description="Each selected stimulus contributes its own rows to the file."
      bind:selected={selectedStimuliIds}
    />
    <ParticipantsStep n={3} bind:selected={selectedParticipantIds} />

    {#if aoiItems.length > 0}
      <SelectionStep
        n={4}
        title="Choose AOIs"
        listTitle="AOIs"
        noun="AOI"
        items={aoiItems}
        presets={aoiPresets}
        bind:selected={selectedAois}
        summaryNote={includeNoAoi ? undefined : 'No_AOI left out'}
      >
        <HelpText>
          Metrics are computed on the ticked AOIs exactly as in a plot whose AOI
          selection holds them: only they get rows or columns, and fixations on
          the other AOIs count as No_AOI. Saved selections come from the
          <button type="button" class="inline-link" onclick={handleEditAois}>AOI library</button>.
        </HelpText>
        <div class="checkbox-row">
          <InputCheck
            label="Include No AOI data"
            sublabel="The No_AOI rows and columns: fixations outside the ticked AOIs. Leaving them out changes no other value, as a plot's Hide No AOI data toggle does."
            bind:checked={includeNoAoi}
          />
        </div>
      </SelectionStep>
    {/if}

    <Step
      n={aoiItems.length > 0 ? 5 : 4}
      title="Configure the file"
      description="The layout and CSV conventions of the exported file. An empty time range covers each participant's full recording."
      summary={fileSummary}
      done={stepFileDone}
      last
    >
      <div class="format-row">
        <Select
          label="Format"
          options={formatOptions}
          bind:value={format}
          onchange={e => handleFormatChange(e.detail as 'long' | 'wide')}
        />
        <HelpText>{formatHelp}</HelpText>
        {#if prunedNotice}
          <HelpText tone="alert">{prunedNotice}</HelpText>
        {/if}
      </div>
      <FieldGrid>
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
        <InputText
          label="Time Start (ms)"
          bind:value={timeStartStr}
          placeholder="Empty = full recording"
        />
        <InputText
          label="Time End (ms)"
          bind:value={timeEndStr}
          placeholder="Empty = full recording"
        />
      </FieldGrid>
      {#if timeRangeError}
        <HelpText tone="error">{timeRangeError}</HelpText>
      {/if}
      <div class="checkbox-row">
        <InputCheck
          label="Include metric codebook"
          sublabel="Creates a ZIP with the data CSV, a codebook CSV describing each column, and the Analysis JSON with the workspace's renames, merges, selections, and metrics."
          bind:checked={includeCodebook}
        />
      </div>
      <HelpText>{formatDetailsText}</HelpText>
    </Step>
  </StepList>

  {#if hasWindowedSelected}
    <div class="pre-export-warning">
      <HelpText tone="alert">
        Windowed metrics export one row per window per participant and can
        produce very large files.
      </HelpText>
    </div>
  {/if}
</ExportShell>

<style>
  .inline-link {
    display: inline;
    background: none;
    border: none;
    color: var(--c-brand);
    cursor: pointer;
    font-size: inherit;
    font-weight: 500;
    line-height: inherit;
    padding: 0;
    text-decoration: underline;
    transition: color var(--transition-fast) ease;
  }

  .inline-link:hover {
    color: var(--c-brand-dark);
  }

  .format-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .checkbox-row {
    margin: 8px 0;
  }

  .pre-export-warning {
    margin-top: 12px;
  }
</style>
