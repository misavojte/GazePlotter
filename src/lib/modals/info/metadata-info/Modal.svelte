<script lang="ts">
  import { onMount } from 'svelte'
  import { triggerDownload } from '$lib/data/export'
  import ModalButtons from '$lib/modals/shared/components/ModalButtons.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { formatFileSize } from '$lib/shared/utils/fileUtils'
  import { formatDuration } from '$lib/shared/utils/timeUtils'
  import { Card } from '$lib/shared/components'
  import MetadataFileList from './components/MetadataFileList.svelte'
  import MetadataMemorySection from './components/MetadataMemorySection.svelte'
  import MetadataOverviewSection from './components/MetadataOverviewSection.svelte'
  import MetadataRecentErrorsSection from './components/MetadataRecentErrorsSection.svelte'
  import MetadataSection from './components/MetadataSection.svelte'
  import {
    buildMetadataCsvReport,
    buildMetadataExportFileName,
    buildMetadataOverview,
    formatMetadataDate,
    getMetadataMemoryInfo,
    isCurrentParsingSameAsSource,
    sumFileSizes,
  } from './helpers'

  const { errorService, ingest, engine, modalState } = getGazePlotterSession()
  const fileMetadata = $derived(ingest.metadata ?? null)
  const currentFileInput = $derived(ingest.input)
  const recentErrors = $derived(errorService.recent)

  let memoryInfo = $state(getMetadataMemoryInfo(performance))

  function updateMemoryInfo(): void {
    memoryInfo = getMetadataMemoryInfo(performance)
  }

  onMount(() => {
    updateMemoryInfo()
    const interval = setInterval(updateMemoryInfo, 2000)

    return () => {
      clearInterval(interval)
    }
  })

  const totalFileSize = $derived(
    fileMetadata === null ? 0 : sumFileSizes(fileMetadata.fileSizes)
  )

  const isSameAsSource = $derived(
    isCurrentParsingSameAsSource(currentFileInput, fileMetadata)
  )

  const dataOverview = $derived(buildMetadataOverview(engine.metadata))

  function exportMetadata(): void {
    try {
      const exportDate = new Date()
      const csvContent = buildMetadataCsvReport(
        {
          overview: dataOverview,
          memoryInfo,
          currentFileInput,
          isSameAsSource,
          fileMetadata,
          recentErrors,
          generatedAt: exportDate.toISOString(),
        },
        {
          formatDate: formatMetadataDate,
          formatDuration,
          formatFileSize,
        }
      )

      triggerDownload(
        new Blob([csvContent], { type: 'text/csv' }),
        buildMetadataExportFileName(exportDate),
        '.csv'
      )
    } catch (error) {
      errorService.report({
        origin: 'export',
        severity: 'recoverable',
        userMessage: 'Could not export metadata report.',
        cause: error,
        context: {
          hasSourceMetadata: fileMetadata !== null,
          recentErrorCount: recentErrors.length,
        },
      })
    }
  }
</script>

<div class="container">
  <MetadataOverviewSection overview={dataOverview} />

  {#if currentFileInput !== null && !isSameAsSource}
    <MetadataSection title="Current parsing">
      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">Files being processed:</span>
          <span class="value">{currentFileInput.fileNames.length}</span>
        </div>
        <MetadataFileList
          fileNames={currentFileInput.fileNames}
          fileSizes={currentFileInput.fileSizes}
        />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">Total file size:</span>
          <span class="value"
            >{formatFileSize(sumFileSizes(currentFileInput.fileSizes))}</span
          >
        </div>
        <div class="info-item">
          <span class="label">Parse date:</span>
          <span class="value"
            >{formatMetadataDate(currentFileInput.parseDate)}</span
          >
        </div>
      </Card>
    </MetadataSection>
  {/if}

  <MetadataSection title="Source parsing (original eye tracking export)">
    {#if fileMetadata === null}
      <Card padding="sm">
        This data was parsed before GazePlotter version 1.7.0 and original
        parsing metadata is thus not available.
      </Card>
    {:else if fileMetadata.status === 'failure'}
      <Card padding="sm" gap="0.5rem" class="failure-details">
        <div class="info-item">
          <span class="label">Error message:</span>
          <span class="value error-message">{fileMetadata.userMessage}</span>
        </div>
        {#if fileMetadata.debugMessage !== fileMetadata.userMessage}
          <div class="info-item">
            <span class="label">Debug message:</span>
            <span class="value">{fileMetadata.debugMessage}</span>
          </div>
        {/if}
        <div class="info-item">
          <span class="label">Error ID:</span>
          <span class="value">{fileMetadata.errorId}</span>
        </div>
        {#if fileMetadata.stack}
          <div class="info-item stack-trace">
            <span class="label">Error details:</span>
            <pre class="value error-stack">{fileMetadata.stack}</pre>
          </div>
        {/if}
      </Card>

      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">Files attempted:</span>
          <span class="value">{fileMetadata.fileNames.length}</span>
        </div>
        <MetadataFileList
          fileNames={fileMetadata.fileNames}
          fileSizes={fileMetadata.fileSizes}
        />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">Total file size:</span>
          <span class="value">{formatFileSize(totalFileSize)}</span>
        </div>
        {#if fileMetadata.attemptedParseDuration !== undefined}
          <div class="info-item">
            <span class="label">Attempted parse duration:</span>
            <span class="value"
              >{formatDuration(fileMetadata.attemptedParseDuration)}</span
            >
          </div>
        {/if}
        <div class="info-item">
          <span class="label">Failure date:</span>
          <span class="value">{formatMetadataDate(fileMetadata.parseDate)}</span
          >
        </div>
      </Card>

      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">GazePlotter version:</span>
          <span class="value">{fileMetadata.gazePlotterVersion}</span>
        </div>
        <div class="info-item">
          <span class="label">Client:</span>
          <span class="value client-info">{fileMetadata.clientUserAgent}</span>
        </div>
      </Card>
    {:else}
      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">Files processed:</span>
          <span class="value">{fileMetadata.fileNames.length}</span>
        </div>
        <MetadataFileList
          fileNames={fileMetadata.fileNames}
          fileSizes={fileMetadata.fileSizes}
        />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">Total file size:</span>
          <span class="value">{formatFileSize(totalFileSize)}</span>
        </div>
        <div class="info-item">
          <span class="label">Parse duration:</span>
          <span class="value">{formatDuration(fileMetadata.parseDuration)}</span
          >
        </div>
        <div class="info-item">
          <span class="label">Parse date:</span>
          <span class="value">{formatMetadataDate(fileMetadata.parseDate)}</span
          >
        </div>
      </Card>

      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">GazePlotter version:</span>
          <span class="value">{fileMetadata.gazePlotterVersion}</span>
        </div>
        <div class="info-item">
          <span class="label">Client:</span>
          <span class="value client-info">{fileMetadata.clientUserAgent}</span>
        </div>
      </Card>

      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">Parse settings:</span>
        </div>
        <div class="settings-container">
          <div class="settings-item">
            <span class="settings-label">Type:</span>
            <span class="settings-value">{fileMetadata.parseSettings.type}</span
            >
          </div>

          <div class="delimiter-row">
            <div class="settings-item">
              <span class="settings-label">Row delimiter:</span>
              <code class="settings-value delimiter-value"
                >{JSON.stringify(fileMetadata.parseSettings.rowDelimiter)}</code
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
      </Card>
    {/if}
  </MetadataSection>

  <MetadataRecentErrorsSection errors={recentErrors} />
  <MetadataMemorySection {memoryInfo} />

  <ModalButtons
    buttons={[
      {
        label: 'Export Metadata',
        onclick: exportMetadata,
        variant: 'primary' as const,
      },
      {
        label: 'Cancel',
        onclick: () => {
          modalState.close()
        },
        isDisabled: false,
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

  /* .info-group styles moved to Card.svelte */

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

  :global(.card.failure-details) {
    background: #fff5f5;
    border: 1px solid #fca5a5;
  }

  .error-message {
    color: #991b1b;
    font-weight: 500;
    text-align: right;
  }

  .stack-trace {
    flex-direction: column;
    align-items: flex-start;
  }

  .error-stack {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #fafafa;
    border: 1px solid #e5e5e5;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    color: #4b5563;
    overflow-x: auto;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: left;
  }
</style>
