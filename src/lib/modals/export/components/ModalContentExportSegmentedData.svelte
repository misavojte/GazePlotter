<script lang="ts">
  import { GeneralInputText, GeneralSelect } from '$lib/shared/components'
  import { SectionHeader, ModalButtons } from '$lib/modals'
  import { WorkplaceDownloader } from '$lib/modals/export/class/WorkplaceDownloader.js'
  import { getData } from '$lib/gaze-data/front-process/stores/dataStore.js'
  import { addSuccessToast } from '$lib/toaster/stores'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { ModalContentDownloadWorkplace } from '$lib/modals/export/components'

  // Export settings state
  let fileName = $state('GazePlotter-SegmentedData')
  let exportType = $state('csv')
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
  const canExport = $derived(fileName.trim().length > 0)

  // Function to handle export
  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      // Small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 100))

      const downloader = new WorkplaceDownloader()
      const data = getData()

      if (exportType === 'csv') {
        downloader.downloadCSV(data, fileName.trim())
        addSuccessToast('Single CSV file exported successfully')
      } else if (exportType === 'individual-csv') {
        downloader.downloadIndividualCSV(data, fileName.trim(), true)
        addSuccessToast('Individual CSV files exported and zipped successfully')
      }
    } catch (error) {
      console.error('Export failed:', error)
      // You might want to add an error toast here
    } finally {
      isExporting = false
    }
  }

  // Function to open workplace download modal
  const handleOpenWorkplaceExport = () => {
    modalStore.open(ModalContentDownloadWorkplace as any, 'Download Workplace')
  }

  // Function to close modal
  const handleCancel = () => {
    modalStore.close()
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
      label: 'More Export Options',
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
        Export processed eye-tracking segments with timing, movement
        classifications, and AOI information for detailed analysis.
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
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Format Details" />
    <div class="content">
      {#if exportType === 'csv'}
        <p class="format-description">
          <strong>Single CSV file</strong> with columns: stimulus, participant, timestamp,
          duration, eyemovementtype, AOI. All participants and stimuli combined in
          one dataset.
        </p>
      {:else}
        <p class="format-description">
          <strong>Individual CSV files</strong> for each participant-stimulus combination
          with columns: timestamp, duration, eyemovementtype, AOI. Files packaged
          in ZIP archive and filtered to fixations only.
        </p>
      {/if}
      <p class="format-description">
        Eye movement types: "0" = fixation, other values = saccades. AOI column
        contains semicolon-separated area names.
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
    color: #666;
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
</style>
