<script lang="ts">
  import { untrack } from 'svelte'
  import type { GridItemMap } from '$lib/workspace'
  import { Select, InputText } from '$lib/shared/components'
  import { Section, ModalButtons, CheckboxListField } from '$lib/modals'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { getParticipantsGroups } from '$lib/data/engine'
  import {
    AGGREGATED_METRIC_CONFIG,
    type AggregatedMetricKey,
    type DecimalSeparator,
  } from '$lib/data/export'
  import {
    createExportButtons,
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    mapSelectableItems,
    toggleSetValue,
    waitForExportUi,
  } from '../shared/helpers'

  interface Props {
    item?: GridItemMap['barPlot']
  }

  let { item }: Props = $props()
  const { exportService, modalState, engine } = getGazePlotterSession()
  const settings = $derived(item?.settings)

  let fileName = $state('GazePlotter-AggregatedData')
  let selectedGroupId = $state(
    untrack(() => settings?.groupId.toString() ?? '-1')
  )
  let selectedStimuliIds = $state(
    untrack(() => new Set([settings?.stimulusId.toString() ?? '0']))
  )
  let delimiter = $state(',')
  let decimalSeparator = $state<DecimalSeparator>('.')
  let isExporting = $state(false)

  let selectedMetrics = $state(
    new Set<AggregatedMetricKey>(AGGREGATED_METRIC_CONFIG.map(m => m.key))
  )

  const metricsItems = $derived(
    mapSelectableItems(
      AGGREGATED_METRIC_CONFIG.map(({ key, label, sublabel }) => ({
        value: key,
        label,
        sublabel,
      })),
      selectedMetrics
    )
  )

  function handleMetricChange(key: string, checked: boolean) {
    selectedMetrics = toggleSetValue(
      selectedMetrics,
      key as AggregatedMetricKey,
      checked
    )
  }

  const stimuliItems = $derived(
    mapSelectableItems(getStimuliOptions(engine), selectedStimuliIds)
  )

  const groupOptions = $derived(
    getParticipantsGroups(engine, true).map(group => ({
      label: group.name,
      value: group.id.toString(),
    }))
  )

  function handleStimulusChange(key: string, checked: boolean) {
    selectedStimuliIds = toggleSetValue(selectedStimuliIds, key, checked)
  }

  const canExport = $derived(
    selectedMetrics.size > 0 &&
      fileName.trim().length > 0 &&
      selectedStimuliIds.size > 0
  )

  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      await waitForExportUi()
      await exportService.exportAggregatedData({
        fileName,
        groupId: parseInt(selectedGroupId),
        stimulusIds: Array.from(selectedStimuliIds).map(id => parseInt(id)),
        metrics: Array.from(selectedMetrics),
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
      exportLabel: 'Export CSV',
      isExporting,
      onCancel: () => modalState.close(),
      onExport: handleExport,
    })
  )
</script>

<div class="container">
  <Section>
    <div class="content">
      <p class="purpose-description">
        Export statistical metrics (dwell time, fixation counts, durations) in
        long format for analysis in R, Python, or SPSS.
      </p>
    </div>
  </Section>

  <Section title="Export Settings">
    <div class="content-two-column">
      <InputText
        label="File name"
        bind:value={fileName}
        placeholder="Enter filename without extension"
      />
      <Select
        label="Participant Group"
        options={groupOptions}
        bind:value={selectedGroupId}
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
    </div>
  </Section>

  <Section title="Data Selection">
    <div class="settings-grid">
      <div class="settings-column">
        <CheckboxListField
          title="Stimuli"
          items={stimuliItems}
          onItemChange={handleStimulusChange}
          hasError={selectedStimuliIds.size === 0}
          errorMessage="Select at least one stimulus to export"
        />
      </div>

      <div class="settings-column">
        <CheckboxListField
          title="Metrics"
          items={metricsItems}
          onItemChange={handleMetricChange}
          hasError={selectedMetrics.size === 0}
          errorMessage="Select at least one metric to export"
        />
      </div>
    </div>
  </Section>

  <Section title="Format Details">
    <div class="content">
      <p class="format-description">
        <strong>Long format CSV</strong> with columns: Participant_ID,
        Participant_Name, Stimulus, AOI_Group, Metric, Value. Includes special
        AOI groups: <strong>No_AOI</strong> (fixations outside any AOI) and
        <strong>Any_Fixation</strong> (aggregated across all fixations).
      </p>
    </div>
  </Section>

  <ModalButtons buttons={exportButtons} />
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    max-width: 600px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .purpose-description {
    margin: 0;
    color: var(--c-text);
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .content-two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 500px) {
    .content-two-column {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    min-height: 0;
  }

  @media (max-width: 700px) {
    .settings-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }

  .settings-column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 0;
  }

  .format-description {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }
</style>
