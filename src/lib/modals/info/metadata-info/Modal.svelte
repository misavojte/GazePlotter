<script lang="ts">
  import { onMount } from 'svelte'
  import ModalButtons from '$lib/modals/shared/components/ModalButtons.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { formatFileSize } from '$lib/shared/utils/fileUtils'
  import { formatDuration } from '$lib/shared/utils/timeUtils'
  import { Card } from '$lib/shared/components'
  import MetadataExclusionsSection from './components/MetadataExclusionsSection.svelte'
  import MetadataFileList from './components/MetadataFileList.svelte'
  import MetadataMemorySection from './components/MetadataMemorySection.svelte'
  import MetadataOverviewSection from './components/MetadataOverviewSection.svelte'
  import MetadataRecentErrorsSection from './components/MetadataRecentErrorsSection.svelte'
  import MetadataSection from './components/MetadataSection.svelte'
  import InfoRow from './components/InfoRow.svelte'
  import {
    buildMetadataCsvReport,
    buildMetadataExportFileName,
    buildMetadataOverview,
    formatMetadataDate,
    getMetadataMemoryInfo,
    isCurrentParsingSameAsSource,
    sumFileSizes,
  } from './helpers'

  const { errorService, ingest, engine, modalState, exportService } =
    getGazePlotterSession()
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

  const dataOverview = $derived.by(() => {
    void engine.eventVersion // recompute when event occurrence buffers change
    return buildMetadataOverview(
      engine.metadata,
      engine.capabilities,
      engine.getEventReader()
    )
  })

  const dataExclusions = $derived(engine.metadata?.dataExclusions ?? [])

  /**
   * Keyed user-input settings (the Tobii parsing config) render as
   * label/value rows; any other value renders raw.
   */
  function userInputEntries(value: string): [string, string][] | null {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
        return null
      return Object.entries(parsed).map(([k, v]) => [k, String(v)])
    } catch {
      return null
    }
  }

  function exportMetadata(): void {
    const exportDate = new Date()
    void exportService.exportMetadataReport({
      fileName: buildMetadataExportFileName(exportDate),
      buildContent: () =>
        buildMetadataCsvReport(
          {
            overview: dataOverview,
            memoryInfo,
            currentFileInput,
            isSameAsSource,
            fileMetadata,
            hasValidData: engine.hasValidData,
            recentErrors,
            dataExclusions,
            merges: engine.metadata?.merges ?? [],
            generatedAt: exportDate.toISOString(),
          },
          {
            formatDate: formatMetadataDate,
            formatDuration,
            formatFileSize,
          }
        ),
    })
  }
</script>

<div class="container">
  <MetadataOverviewSection overview={dataOverview} />

  <MetadataExclusionsSection exclusions={dataExclusions} />

  {#if currentFileInput !== null && !isSameAsSource}
    <MetadataSection title="Current parsing">
      <Card padding="sm" gap="0.5rem">
        <InfoRow label="Files being processed:" value={currentFileInput.fileNames.length} />
        <MetadataFileList
          fileNames={currentFileInput.fileNames}
          fileSizes={currentFileInput.fileSizes}
        />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <InfoRow
          label="Total file size:"
          value={formatFileSize(sumFileSizes(currentFileInput.fileSizes))}
        />
        <InfoRow
          label="Parse date:"
          value={formatMetadataDate(currentFileInput.parseDate)}
        />
      </Card>
    </MetadataSection>
  {/if}

  <MetadataSection title="Source parsing (original eye tracking export)">
    {#if fileMetadata === null}
      <Card padding="sm">
        {#if engine.hasValidData}
          This data was parsed before GazePlotter version 1.7.0 and original
          parsing metadata is thus not available.
        {:else}
          No data has been loaded.
        {/if}
      </Card>
    {:else if fileMetadata.status === 'failure'}
      <Card padding="sm" gap="0.5rem" class="failure-details">
        <InfoRow label="Error message:" value={fileMetadata.userMessage} variant="error" />
        {#if fileMetadata.debugMessage !== fileMetadata.userMessage}
          <InfoRow label="Debug message:" value={fileMetadata.debugMessage} />
        {/if}
        <InfoRow label="Error ID:" value={fileMetadata.errorId} />
        {#if fileMetadata.stack}
          <InfoRow label="Error details:" value={fileMetadata.stack} variant="stack" />
        {/if}
      </Card>

      <Card padding="sm" gap="0.5rem">
        <InfoRow label="Files attempted:" value={fileMetadata.fileNames.length} />
        <MetadataFileList
          fileNames={fileMetadata.fileNames}
          fileSizes={fileMetadata.fileSizes}
        />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <InfoRow label="Total file size:" value={formatFileSize(totalFileSize)} />
        {#if fileMetadata.attemptedParseDuration !== undefined}
          <InfoRow
            label="Attempted parse duration:"
            value={formatDuration(fileMetadata.attemptedParseDuration)}
          />
        {/if}
        <InfoRow label="Failure date:" value={formatMetadataDate(fileMetadata.parseDate)} />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <InfoRow label="GazePlotter version:" value={fileMetadata.gazePlotterVersion} />
        <InfoRow label="Client:" value={fileMetadata.clientUserAgent} variant="mono" />
      </Card>
    {:else}
      <Card padding="sm" gap="0.5rem">
        <InfoRow label="Files processed:" value={fileMetadata.fileNames.length} />
        <MetadataFileList
          fileNames={fileMetadata.fileNames}
          fileSizes={fileMetadata.fileSizes}
        />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <InfoRow label="Total file size:" value={formatFileSize(totalFileSize)} />
        <InfoRow label="Parse duration:" value={formatDuration(fileMetadata.parseDuration)} />
        <InfoRow label="Parse date:" value={formatMetadataDate(fileMetadata.parseDate)} />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <InfoRow label="GazePlotter version:" value={fileMetadata.gazePlotterVersion} />
        <InfoRow label="Client:" value={fileMetadata.clientUserAgent} variant="mono" />
      </Card>

      <Card padding="sm" gap="0.5rem">
        <InfoRow label="Parse settings:" />
        <div class="settings-container">
          <InfoRow label="Type:" value={fileMetadata.parseSettings.type} />

          <div class="delimiter-row">
            <div class="delimiter-item">
              <InfoRow label="Row delimiter:">
                <code class="delimiter-value">{JSON.stringify(fileMetadata.parseSettings.rowDelimiter)}</code>
              </InfoRow>
            </div>
            <div class="delimiter-item">
              <InfoRow label="Column delimiter:">
                <code class="delimiter-value"
                  >{JSON.stringify(
                    fileMetadata.parseSettings.columnDelimiter
                  )}</code
                >
              </InfoRow>
            </div>
          </div>

          {#if 'userInputSetting' in fileMetadata.parseSettings}
            {@const entries = userInputEntries(
              fileMetadata.parseSettings.userInputSetting
            )}
            {#if entries}
              {#each entries as [key, value] (key)}
                <InfoRow label={`${key}:`} value={value} />
              {/each}
            {:else}
              <InfoRow
                label="User input setting:"
                value={fileMetadata.parseSettings.userInputSetting || '(empty)'}
              />
            {/if}
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
    max-width: 600px;
  }

  /* .info-group styles moved to Card.svelte */

  .settings-container {
    margin-left: 1rem;
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .delimiter-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .delimiter-row .delimiter-item {
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
</style>
