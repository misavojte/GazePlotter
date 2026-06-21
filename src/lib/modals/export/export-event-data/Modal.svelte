<script lang="ts">
  import { InputText, Select } from '$lib/shared/components'
  import { Section, ModalButtons, CheckboxListField } from '$lib/modals'
  import type { DecimalSeparator, ExportNaming } from '$lib/data/export'
  import { getGazePlotterSession } from '$lib/session'
  import { getStimuliOptions } from '$lib/plots/shared'
  import {
    createExportButtons,
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    EXPORT_NAMING_OPTIONS,
    mapSelectableItems,
    toggleSetValue,
    waitForExportUi,
  } from '../shared/helpers'

  const { engine, exportService, modalState } = getGazePlotterSession()
  let fileName = $state('GazePlotter-EventData')
  let exportType = $state('csv')
  let delimiter = $state(',')
  let decimalSeparator = $state<DecimalSeparator>('.')
  let naming = $state<ExportNaming>('displayed')
  let selectedStimuliIds = $state(new Set<string>())
  let isExporting = $state(false)

  const exportOptions = [
    {
      value: 'csv',
      label: 'Single CSV File',
    },
    {
      value: 'individual-csv',
      label: 'Individual CSV Files (Zipped)',
    },
  ]

  const canExport = $derived(
    fileName.trim().length > 0 && selectedStimuliIds.size > 0
  )

  const stimuliItems = $derived(
    mapSelectableItems(getStimuliOptions(engine), selectedStimuliIds)
  )

  function handleStimulusChange(key: string, checked: boolean) {
    selectedStimuliIds = toggleSetValue(selectedStimuliIds, key, checked)
  }

  $effect(() => {
    selectedStimuliIds = new Set(
      getStimuliOptions(engine).map(({ value }) => value)
    )
  })

  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      await waitForExportUi()
      await exportService.exportEventData({
        fileName,
        exportType: exportType as 'csv' | 'individual-csv',
        stimulusIds: selectedStimuliIds,
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

<div class="container">
  <Section>
    <div class="content">
      <p class="purpose-description">
        Export event occurrences with their timing per participant and stimulus.
      </p>
    </div>
  </Section>

  <Section title="Export Settings">
    <div class="content-two-column">
      <Select
        label="Export Type"
        options={exportOptions}
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
    </div>
  </Section>

  <Section title="Format Details">
    <div class="content">
      <p class="format-description">
        <strong>CSV format</strong> with columns: stimulus, participant,
        eventName, start, duration. Times are in milliseconds; a duration of 0
        marks an instant event. A single-file export can be re-imported as an
        event file alongside its eye-tracking data.
      </p>
      <p class="format-description">
        Naming: "Displayed" uses your renamed event names, merges channels
        grouped under the same name, hides hidden channels, and includes derived
        interval channels (the on-screen result). "Raw" uses the original
        imported channel names with no grouping and excludes derived interval
        channels.
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

  .format-description {
    margin: 0 0 0.75rem 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .format-description:last-child {
    margin-bottom: 0;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
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
  }
</style>
