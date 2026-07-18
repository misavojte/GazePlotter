<script lang="ts">
  import { untrack } from 'svelte'
  import { Select, InputText, InputCheck } from '$lib/shared/components'
  import {
    ModalButtons,
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
    createExportButtons,
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    listSummary,
    mapSelectableItems,
    toggleSetValue,
    runExport,
  } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'
  import ExportProgressBar from '../shared/ExportProgressBar.svelte'
  import StimuliSelect from '../shared/StimuliSelect.svelte'
  import ParticipantsSelect from '../shared/ParticipantsSelect.svelte'
  import { defaultStimulusSelection, stimuliSelectionSummary } from '../shared/stimuli'
  import {
    defaultParticipantSelection,
    orderedSelectedParticipantIds,
    participantsSelectionSummary,
  } from '../shared/participants'
  import {
    instanceMatchesContract,
    metricLibraryModal,
    instanceReadout,
    formatProjectionReadout,
    getMetric,
    projectionOutputShape,
    defaultInstanceLabel,
  } from '$lib/metrics'
  import { multiSelectMetricHandlers } from '$lib/plots/shared/metricInstanceHandlers'

  interface Props {
    /** Prefill: preselect this participant group's members. */
    groupId?: number
    stimulusId?: number
    metricInstanceIds?: string[]
  }

  let { groupId, stimulusId, metricInstanceIds }: Props = $props()
  const { exportService, modalState, engine, workspace } = getGazePlotterSession()

  let format = $state<'long' | 'wide'>('long')
  const fileName = 'GazePlotter-MetricData'
  let delimiter = $state(',')
  let decimalSeparator = $state<'.' | ','>('.')
  let includeCodebook = $state(true)
  let timeStartStr = $state('')
  let timeEndStr = $state('')
  let isExporting = $state(false)

  // Prefill props are read once by design (untrack): they seed the selection,
  // they don't bind it.
  let selectedStimuliIds = $state(
    untrack(() => defaultStimulusSelection(engine, stimulusId))
  )
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
        instanceMatchesContract(inst, METRIC_EXPORT_CONTRACT_LONG) &&
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
      return inst && instanceMatchesContract(inst, activeContract)
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
      return inst && instanceMatchesContract(inst, nextContract)
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

  const metricsItems = $derived(
    mapSelectableItems(
      (engine.metadata?.metricInstances ?? []).map(inst => {
        const label = inst.label || defaultInstanceLabel(inst.baseId)
        const readoutChips = instanceReadout(inst, { includeReduction: false })
        const projReadout = formatProjectionReadout(inst)
        if (projReadout) readoutChips.push(projReadout)
        const m = getMetric(inst.baseId)
        if (m?.meta.unit) readoutChips.push(m.meta.unit)

        const sublabel = readoutChips.join(' · ')
        const matches = instanceMatchesContract(inst, activeContract)

        let reason = ''
        if (!matches) {
          reason =
            inst.projection.kind === 'windowed'
              ? 'Time series, available in the long format'
              : 'Not exportable in this format'
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
    const total = (engine.metadata?.metricInstances ?? []).length
    const count = activeSelectedMetrics.length
    const single =
      count === 1 ? instancesById.get(activeSelectedMetrics[0])?.label : undefined
    return listSummary(count, total, single)
  })

  const stimuliSummary = $derived(
    stimuliSelectionSummary(engine, selectedStimuliIds)
  )

  const participantsSummary = $derived(
    participantsSelectionSummary(engine, selectedParticipantIds)
  )

  const fileSummary = $derived.by(() => {
    const parts = [
      format === 'long' ? 'Long (tidy)' : 'Wide',
      includeCodebook ? 'CSV + codebook' : 'CSV',
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
        const label = previewLabels.get(inst.id) ?? inst.label
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
    if (invalid(timeStart) || invalid(timeEnd)) {
      return 'Time range must be a non-negative number of milliseconds'
    }
    if (timeEnd !== undefined && timeEnd <= (timeStart ?? 0)) {
      return 'Time end must be greater than time start'
    }
    return null
  })

  // ── Step completion: the badge turns into a check when its step is valid ───
  const stepMetricsDone = $derived(activeSelectedMetrics.length > 0)
  const stepStimuliDone = $derived(selectedStimuliIds.size > 0)
  const stepParticipantsDone = $derived(selectedParticipantIds.size > 0)
  const stepFileDone = $derived(timeRangeError === null)

  const canExport = $derived(
    stepMetricsDone && stepStimuliDone && stepParticipantsDone && stepFileDone
  )

  const handleExport = async () => {
    if (!canExport) return

    await runExport(
      val => (isExporting = val),
      () =>
        exportService.exportMetricData({
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
        })
    )
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
  intro="Export eye-tracking metrics from the library, computed per participant and stimulus."
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

    <Step
      n={2}
      title="Choose stimuli"
      description="Each selected stimulus contributes its own rows to the file."
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
      n={3}
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
      n={4}
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
          placeholder="Default full recording (0)"
        />
        <InputText
          label="Time End (ms)"
          bind:value={timeEndStr}
          placeholder="Default full recording (0)"
        />
      </FieldGrid>
      {#if timeRangeError}
        <HelpText tone="error">{timeRangeError}</HelpText>
      {/if}
      <div class="checkbox-row">
        <InputCheck
          label="Include metric codebook"
          sublabel="Creates a ZIP download containing the data CSV and a descriptive sidecar CSV."
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

  <ExportProgressBar progress={exportService.progress} />

  <ModalButtons buttons={exportButtons} />
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
    gap: 0.35rem;
    margin-bottom: 0.75rem;
  }

  .checkbox-row {
    margin: 0.5rem 0;
  }

  .pre-export-warning {
    margin-top: 0.75rem;
  }
</style>
