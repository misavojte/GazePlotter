<script lang="ts">
  import {
    GeneralInputText,
    GeneralSelect,
    GeneralInputGroup,
  } from '$lib/shared/components'
  import { SectionHeader, ModalButtons } from '$lib/modals'
  import type { DecimalSeparator } from '$lib/data/export'
  import { getGazePlotterSession } from '$lib/session'
  import { ModalContentDownloadWorkplace } from '$lib/modals/export/components'
  import { getStimuliOptions } from '$lib/plots/shared/selectOptionsGetters'

  const { engine, exportService, modalState } = getGazePlotterSession()
  // Export settings state
  let fileName = $state('GazePlotter-SegmentedData')
  let exportType = $state('csv')
  let delimiter = $state(',')
  let decimalSeparator = $state<DecimalSeparator>('.')
  let exportFixationsOnly = $state(false)
  let selectedStimuliIds = $state(new Set<string>())
  let isExporting = $state(false)

  // Export type options
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

  // Validation
  const canExport = $derived(
    fileName.trim().length > 0 && selectedStimuliIds.size > 0
  )

  const delimiterOptions = [
    { value: ',', label: 'Comma (,)' },
    { value: ';', label: 'Semicolon (;)' },
  ]

  const decimalSeparatorOptions = [
    { value: '.', label: 'Dot (.)' },
    { value: ',', label: 'Comma (,)' },
  ]

  // Get stimuli options
  const stimuliItems = $derived(
    getStimuliOptions(engine).map(option => ({
      key: option.value,
      label: option.label,
      checked: selectedStimuliIds.has(option.value),
    }))
  )

  // Handle stimulus selection changes
  function handleStimulusChange(key: string, checked: boolean) {
    if (checked) {
      selectedStimuliIds.add(key)
    } else {
      selectedStimuliIds.delete(key)
    }
    selectedStimuliIds = new Set(selectedStimuliIds) // Trigger reactivity
  }

  // Pre-select all stimuli by default
  $effect(() => {
    const options = getStimuliOptions(engine)
    selectedStimuliIds = new Set(options.map(o => o.value))
  })

  // Function to handle export
  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      // Small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 100))
      await exportService.exportSegmentedData({
        fileName,
        exportType: exportType as 'csv' | 'individual-csv',
        stimulusIds: selectedStimuliIds,
        filterFixations: exportFixationsOnly,
        csvOptions: {
          delimiter,
          decimalSeparator,
        },
      })
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      isExporting = false
    }
  }

  // Function to open workplace download modal
  const handleOpenWorkplaceExport = () => {
    modalState.open(ModalContentDownloadWorkplace as any, 'Download Workplace')
  }

  // Function to close modal
  const handleCancel = () => {
    modalState.close()
  }

  // Button configuration
  const exportButtons = $derived([
    {
      label: isExporting ? 'Exporting...' : 'Export Data',
      onclick: handleExport,
      isDisabled: !canExport || isExporting,
      variant: 'primary' as const,
    },
    {
      label: 'All Data Formats',
      onclick: handleOpenWorkplaceExport,
      isDisabled: false,
    },
    {
      label: 'Cancel',
      onclick: handleCancel,
      isDisabled: false,
    },
  ])
</script>

<div class="container">
  <section class="section">
    <div class="content">
      <p class="purpose-description">
        Export eye-tracking segments with timing, movement classifications, and
        AOI information.
      </p>
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Export Settings" />
    <div class="content-two-column">
      <GeneralSelect
        label="Export Type"
        options={exportOptions}
        bind:value={exportType}
      />
      <GeneralInputText
        label="File name"
        bind:value={fileName}
        placeholder="Enter filename without extension"
      />
      <GeneralSelect
        label="Delimiter"
        options={delimiterOptions}
        bind:value={delimiter}
      />
      <GeneralSelect
        label="Decimal Separator"
        options={decimalSeparatorOptions}
        bind:value={decimalSeparator}
      />
    </div>
  </section>

  <section class="section">
    <div class="settings-grid">
      <div class="settings-column">
        <GeneralInputGroup
          title="Stimuli"
          items={stimuliItems}
          onItemChange={handleStimulusChange}
        />
        {#if selectedStimuliIds.size === 0}
          <p class="validation-message">
            Select at least one stimulus to export
          </p>
        {/if}
      </div>

      <div class="settings-column">
        <GeneralInputGroup
          title="Filters"
          showControls={false}
          items={[
            {
              key: 'fixationsOnly',
              label: 'Export only fixations',
              checked: exportFixationsOnly,
            },
          ]}
          onItemChange={(_, checked) => (exportFixationsOnly = checked)}
        />
      </div>
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Format Details" />
    <div class="content">
      <p class="format-description">
        <strong>CSV format</strong> with columns: stimulus, participant, timestamp,
        duration, eyemovementtype, AOI. Output respects selected stimuli and filter
        settings.
      </p>
      <p class="format-description">
        Eye movement types: "0" = fixation, other values = saccades etc. AOI
        column contains semicolon-separated area names.
      </p>
    </div>
  </section>

  <section class="section">
    <ModalButtons buttons={exportButtons} />
  </section>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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

  .validation-message {
    margin: 0;
    padding: 0.5rem;
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    color: #856404;
    font-size: 0.85rem;
  }
</style>
