<script lang="ts">
  import SectionHeader from '$lib/modals/shared/components/SectionHeader.svelte'
  import {
    fileMetadataStore,
    currentFileInputStore,
  } from '$lib/workspace/stores/fileStore'

  const fileMetadata = $derived($fileMetadataStore)
  const currentFileInput = $derived($currentFileInputStore)

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
   * Formats duration in milliseconds to human-readable format
   */
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(2)} seconds`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = (seconds % 60).toFixed(0)
    return `${minutes}m ${remainingSeconds}s`
  }

  /**
   * Formats ISO date string to readable format
   */
  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleString()
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
</script>

<div class="container">
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
</style>
