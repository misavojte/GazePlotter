<script lang="ts">
  import SectionHeader from '$lib/modals/shared/components/SectionHeader.svelte'
  import ModalButtons from '$lib/modals/shared/components/ModalButtons.svelte'
  import {
    fileMetadataStore,
    currentFileInputStore,
  } from '$lib/workspace/stores/fileStore'
  import { formatDuration } from '$lib/shared/utils/timeUtils'
  import {
    getData,
    getNumberOfStimuli,
    getNumberOfParticipants,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { onMount, onDestroy } from 'svelte'

  const fileMetadata = $derived($fileMetadataStore)
  const currentFileInput = $derived($currentFileInputStore)

  // Memory monitoring state
  let memoryInfo = $state<{
    used: number
    total: number
    limit: number
    available: boolean
  }>({
    used: 0,
    total: 0,
    limit: 0,
    available: false,
  })

  let memoryUpdateInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Updates memory information if available
   */
  function updateMemoryInfo(): void {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory
      memoryInfo = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        available: true,
      }
    } else {
      memoryInfo = {
        used: 0,
        total: 0,
        limit: 0,
        available: false,
      }
    }
  }

  // Start memory monitoring when component mounts
  onMount(() => {
    updateMemoryInfo()
    // Update memory info every 2 seconds
    memoryUpdateInterval = setInterval(updateMemoryInfo, 2000)
  })

  // Clean up interval when component unmounts
  onDestroy(() => {
    if (memoryUpdateInterval !== null) {
      clearInterval(memoryUpdateInterval)
      memoryUpdateInterval = null
    }
  })

  /**
   * Formats file size in bytes to human-readable format
   */
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Formats ISO date string to readable format
   */
  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleString()
  }

  /**
   * Gets the number of AOIs per stimulus and total
   */
  function getAoiCounts(): {
    perStimulus: { stimulusName: string; count: number }[]
    total: number
  } {
    try {
      const data = getData()
      const perStimulus: { stimulusName: string; count: number }[] = []
      let total = 0

      for (let i = 0; i < data.stimuli.data.length; i++) {
        const stimulusName = data.stimuli.data[i][0]
        const aoiCount = data.aois.data[i]?.length || 0
        perStimulus.push({ stimulusName, count: aoiCount })
        total += aoiCount
      }

      return { perStimulus, total }
    } catch (error) {
      return { perStimulus: [], total: 0 }
    }
  }

  /**
   * Exports metadata as CSV file
   */
  function exportMetadata(): void {
    try {
      const overview = dataOverview
      const timestamp = new Date().toISOString()

      // Build CSV content
      let csvContent = `GazePlotter Metadata Export\nGenerated,${timestamp}\n\n`

      // Data Overview Section
      csvContent += `Section,Data Overview\n`
      csvContent += `Metric,Value\n`
      csvContent += `Number of Stimuli,${overview.numberOfStimuli}\n`
      csvContent += `Number of Participants,${overview.numberOfParticipants}\n`
      csvContent += `Total Number of AOIs,${overview.aoiCounts.total}\n\n`

      // RAM Usage Section
      if (memoryInfo.available) {
        csvContent += `Section,RAM Usage\n`
        csvContent += `Metric,Value\n`
        csvContent += `Current JS Heap Size (used),${formatFileSize(memoryInfo.used)}\n`
        csvContent += `Total JS Heap Size (allocated),${formatFileSize(memoryInfo.total)}\n`
        csvContent += `JS Heap Size Limit (max available),${formatFileSize(memoryInfo.limit)}\n`
        csvContent += `Memory utilization,${((memoryInfo.used / memoryInfo.limit) * 100).toFixed(1)}% of limit\n\n`
      }

      // AOIs per Stimulus
      if (overview.aoiCounts.perStimulus.length > 0) {
        csvContent += `Section,AOIs per Stimulus\n`
        csvContent += `Stimulus Name,AOI Count\n`
        for (const stimulus of overview.aoiCounts.perStimulus) {
          csvContent += `${stimulus.stimulusName},${stimulus.count}\n`
        }
        csvContent += `\n`
      }

      // Current Parsing Info (if different from source)
      if (currentFileInput !== null && !isSameAsSource) {
        csvContent += `Section,Current Parsing\n`
        csvContent += `Metric,Value\n`
        csvContent += `Files Being Processed,${currentFileInput.fileNames.length}\n`
        csvContent += `Total File Size,${formatFileSize(currentFileInput.fileSizes.reduce((sum: number, size: number) => sum + size, 0))}\n`
        csvContent += `Parse Date,${formatDate(currentFileInput.parseDate)}\n\n`

        csvContent += `Section,Current Parsing Files\n`
        csvContent += `File Name,File Size (bytes)\n`
        for (let i = 0; i < currentFileInput.fileNames.length; i++) {
          csvContent += `${currentFileInput.fileNames[i]},${currentFileInput.fileSizes[i]}\n`
        }
        csvContent += `\n`
      }

      // Source Parsing Info
      if (fileMetadata !== null) {
        csvContent += `Section,Source Parsing\n`
        csvContent += `Metric,Value\n`
        csvContent += `Files Processed,${fileMetadata.fileNames.length}\n`
        csvContent += `Total File Size,${formatFileSize(totalFileSize)}\n`
        csvContent += `Parse Duration,${formatDuration(fileMetadata.parseDuration)}\n`
        csvContent += `Parse Date,${formatDate(fileMetadata.parseDate)}\n`
        csvContent += `GazePlotter Version,${fileMetadata.gazePlotterVersion}\n`
        csvContent += `Client,"${fileMetadata.clientUserAgent}"\n\n`

        csvContent += `Section,Source Parsing Files\n`
        csvContent += `File Name,File Size (bytes)\n`
        for (let i = 0; i < fileMetadata.fileNames.length; i++) {
          csvContent += `${fileMetadata.fileNames[i]},${fileMetadata.fileSizes[i]}\n`
        }
        csvContent += `\n`

        // Parse Settings
        csvContent += `Section,Parse Settings\n`
        csvContent += `Setting,Value\n`
        csvContent += `Type,${fileMetadata.parseSettings.type}\n`
        csvContent += `Row Delimiter,"${JSON.stringify(fileMetadata.parseSettings.rowDelimiter)}"\n`
        csvContent += `Column Delimiter,"${JSON.stringify(fileMetadata.parseSettings.columnDelimiter)}"\n`
        if ('userInputSetting' in fileMetadata.parseSettings) {
          csvContent += `User Input Setting,${fileMetadata.parseSettings.userInputSetting || '(empty)'}\n`
        }
      } else {
        csvContent += `Section,Source Parsing\n`
        csvContent += `Note,This data was parsed before GazePlotter version 1.7.0 and original parsing metadata is not available.\n\n`
      }

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `GazePlotter_Metadata_${new Date().toISOString().split('T')[0]}.csv`
      link.style.opacity = '0'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting metadata:', error)
    }
  }

  const totalFileSize = $derived(
    fileMetadata?.fileSizes.reduce(
      (sum: number, size: number) => sum + size,
      0
    ) ?? 0
  )

  // Check if current parsing is the same as source file parsing
  const isSameAsSource = $derived(
    currentFileInput !== null &&
      fileMetadata !== null &&
      JSON.stringify(currentFileInput.fileNames) ===
        JSON.stringify(fileMetadata.fileNames) &&
      JSON.stringify(currentFileInput.fileSizes) ===
        JSON.stringify(fileMetadata.fileSizes) &&
      currentFileInput.parseDate === fileMetadata.parseDate
  )

  // Data overview calculations
  const dataOverview = $derived.by(() => {
    try {
      const numberOfStimuli = getNumberOfStimuli()
      const numberOfParticipants = getNumberOfParticipants()
      const aoiCounts = getAoiCounts()

      return {
        numberOfStimuli,
        numberOfParticipants,
        aoiCounts,
      }
    } catch (error) {
      return {
        numberOfStimuli: 0,
        numberOfParticipants: 0,
        aoiCounts: { perStimulus: [], total: 0 },
      }
    }
  })
</script>

<div class="container">
  <!-- Data overview section -->
  <section class="section">
    <SectionHeader text="Data overview" />
    <div class="content">
      <div class="info-group">
        <div class="info-item">
          <span class="label">Number of stimuli:</span>
          <span class="value">{dataOverview.numberOfStimuli}</span>
        </div>
        <div class="info-item">
          <span class="label">Number of participants:</span>
          <span class="value">{dataOverview.numberOfParticipants}</span>
        </div>
        <div class="info-item">
          <span class="label">Total number of AOIs:</span>
          <span class="value">{dataOverview.aoiCounts.total}</span>
        </div>
      </div>

      {#if dataOverview.aoiCounts.perStimulus.length > 0}
        <div class="info-group">
          <div class="info-item">
            <span class="label">AOIs per stimulus:</span>
          </div>
          <div class="aoi-list">
            {#each dataOverview.aoiCounts.perStimulus as stimulus}
              <div class="aoi-item">
                <span class="stimulus-name">{stimulus.stimulusName}</span>
                <span class="aoi-count"
                  >{stimulus.count} AOI{stimulus.count !== 1 ? 's' : ''}</span
                >
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </section>

  <!-- Current parsing section -->
  {#if currentFileInput !== null && !isSameAsSource}
    <section class="section">
      <SectionHeader text="Current parsing" />
      <div class="content">
        {#if isSameAsSource}
          <div class="info-group">
            Same as Source parsing (this is an original eye tracking data
            import)
          </div>
        {:else}
          <div class="info-group">
            <div class="info-item">
              <span class="label">Files being processed:</span>
              <span class="value">{currentFileInput.fileNames.length}</span>
            </div>
            <div class="file-list">
              {#each currentFileInput.fileNames as fileName, index}
                <div class="file-item">
                  <span class="file-name">{fileName}</span>
                  <span class="file-size"
                    >({formatFileSize(currentFileInput.fileSizes[index])})</span
                  >
                </div>
              {/each}
            </div>
          </div>

          <div class="info-group">
            <div class="info-item">
              <span class="label">Total file size:</span>
              <span class="value"
                >{formatFileSize(
                  currentFileInput.fileSizes.reduce(
                    (sum: number, size: number) => sum + size,
                    0
                  )
                )}</span
              >
            </div>
            <div class="info-item">
              <span class="label">Parse date:</span>
              <span class="value">{formatDate(currentFileInput.parseDate)}</span
              >
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Source file parsing section -->
  <section class="section">
    <SectionHeader text="Source parsing (original eye tracking export)" />
    <div class="content">
      {#if fileMetadata === null}
        <div class="info-group">
          This data was parsed before GazePlotter version 1.7.0 and original
          parsing metadata is thus not available.
        </div>
      {:else}
        <div class="info-group">
          <div class="info-item">
            <span class="label">Files processed:</span>
            <span class="value">{fileMetadata.fileNames.length}</span>
          </div>
          <div class="file-list">
            {#each fileMetadata.fileNames as fileName, index}
              <div class="file-item">
                <span class="file-name">{fileName}</span>
                <span class="file-size"
                  >({formatFileSize(fileMetadata.fileSizes[index])})</span
                >
              </div>
            {/each}
          </div>
        </div>

        <div class="info-group">
          <div class="info-item">
            <span class="label">Total file size:</span>
            <span class="value">{formatFileSize(totalFileSize)}</span>
          </div>
          <div class="info-item">
            <span class="label">Parse duration:</span>
            <span class="value"
              >{formatDuration(fileMetadata.parseDuration)}</span
            >
          </div>
          <div class="info-item">
            <span class="label">Parse date:</span>
            <span class="value">{formatDate(fileMetadata.parseDate)}</span>
          </div>
        </div>

        <div class="info-group">
          <div class="info-item">
            <span class="label">GazePlotter version:</span>
            <span class="value">{fileMetadata.gazePlotterVersion}</span>
          </div>
          <div class="info-item">
            <span class="label">Client:</span>
            <span class="value client-info">{fileMetadata.clientUserAgent}</span
            >
          </div>
        </div>

        <div class="info-group">
          <div class="info-item">
            <span class="label">Parse settings:</span>
          </div>
          <div class="settings-container">
            <div class="settings-item">
              <span class="settings-label">Type:</span>
              <span class="settings-value"
                >{fileMetadata.parseSettings.type}</span
              >
            </div>

            <div class="delimiter-row">
              <div class="settings-item">
                <span class="settings-label">Row delimiter:</span>
                <code class="settings-value delimiter-value"
                  >{JSON.stringify(
                    fileMetadata.parseSettings.rowDelimiter
                  )}</code
                >
              </div>
              <div class="settings-item">
                <span class="settings-label">Column delimiter:</span>
                <code class="settings-value delimiter-value"
                  >{JSON.stringify(
                    fileMetadata.parseSettings.columnDelimiter
                  )}</code
                >
              </div>
            </div>

            {#if 'userInputSetting' in fileMetadata.parseSettings}
              <div class="settings-item">
                <span class="settings-label">User input setting:</span>
                <span class="settings-value"
                  >{fileMetadata.parseSettings.userInputSetting ||
                    '(empty)'}</span
                >
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </section>
  <!-- RAM Usage section -->
  {#if memoryInfo.available}
    <section class="section">
      <SectionHeader text="RAM Usage" />
      <div class="content">
        <div class="info-group">
          <div class="info-item">
            <span class="label">Current JS Heap Size (used):</span>
            <span class="value">{formatFileSize(memoryInfo.used)}</span>
          </div>
          <div class="info-item">
            <span class="label">Total JS Heap Size (allocated):</span>
            <span class="value">{formatFileSize(memoryInfo.total)}</span>
          </div>
          <div class="info-item">
            <span class="label">JS Heap Size Limit (max available):</span>
            <span class="value">{formatFileSize(memoryInfo.limit)}</span>
          </div>
          <div class="info-item">
            <span class="label">Memory utilization:</span>
            <span class="value"
              >{((memoryInfo.used / memoryInfo.limit) * 100).toFixed(1)}% of
              limit</span
            >
          </div>
        </div>
      </div>
    </section>
  {/if}

  <!-- Export button section -->
  <ModalButtons
    buttons={[
      {
        label: 'Export Metadata',
        onclick: exportMetadata,
      },
    ]}
  />
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
    gap: 1rem;
  }

  .info-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f9f9f9;
    border-radius: 0.375rem;
    border: 1px solid #e5e5e5;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .label {
    font-weight: 500;
    color: #374151;
    min-width: fit-content;
  }

  .value {
    color: #1f2937;
    text-align: right;
    word-break: break-word;
  }

  .client-info {
    font-family: monospace;
    font-size: 0.85rem;
    max-width: 300px;
    word-break: break-all;
  }

  .file-list {
    margin-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .file-name {
    color: #374151;
    font-weight: 500;
  }

  .file-size {
    color: #6b7280;
    font-size: 0.85rem;
  }

  .settings-container {
    margin-left: 1rem;
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .settings-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .settings-label {
    font-weight: 500;
    color: #374151;
    min-width: fit-content;
  }

  .settings-value {
    color: #1f2937;
    text-align: right;
    word-break: break-word;
  }

  .delimiter-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .delimiter-row .settings-item {
    flex: 1;
    min-width: 200px;
  }

  .delimiter-value {
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
  }

  .aoi-list {
    margin-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .aoi-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .stimulus-name {
    color: #374151;
    font-weight: 500;
  }

  .aoi-count {
    color: #6b7280;
    font-size: 0.85rem;
  }
</style>
