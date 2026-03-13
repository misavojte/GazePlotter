<script lang="ts">
  import { setContext, tick } from 'svelte'
  import MajorButton from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSource,
    type ExportSourceRegistrar,
    canvasToBlobWithWhiteBackground,
    triggerDownload,
    getMimeType,
    getQuality,
  } from '$lib/data/export'

  // Component props
  interface Props {
    fileName: string
    fileType: '.png' | '.jpg'
    showDownloadButton?: boolean
    children: any // Child component that renders to Canvas
  }

  let {
    fileName,
    fileType,
    showDownloadButton = false,
    children,
  }: Props = $props()
  const { errorService } = getGazePlotterSession()

  // States
  let componentContainer = $state<HTMLElement | null>(null) // Container for the child component
  let isGeneratingDownload = $state(false)
  let exportSource = $state<ExportSource | null>(null)
  let previewRenderError = $state<unknown | null>(null)

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error
    }

    return 'Unknown preview error'
  }

  const registrar: ExportSourceRegistrar = {
    register: source => {
      exportSource = source
    },
  }

  setContext(EXPORT_SOURCE_CONTEXT, registrar)

  const isDownloadDisabled = $derived(
    isGeneratingDownload || previewRenderError !== null
  )

  function reportPreviewRenderError(error: unknown) {
    previewRenderError = error
    exportSource = null

    errorService.report({
      origin: 'export',
      severity: 'recoverable',
      userMessage:
        'Could not render the export preview. The dialog is still available.',
      cause: error,
      context: {
        fileName,
        fileType,
      },
    })
  }

  function retryPreview(reset: () => void) {
    previewRenderError = null
    exportSource = null
    reset()
  }

  // Function to generate high-resolution download
  async function generateDownload() {
    await tick()

    const resolvedCanvas =
      exportSource?.kind === 'canvas' ? exportSource.getCanvas() : null

    if (!resolvedCanvas) {
      errorService.report({
        origin: 'export',
        severity: 'recoverable',
        userMessage: 'Nothing to export: plot did not register an export source.',
        cause: new Error(
          'Plot preview export source was not registered before download.'
        ),
        context: {
          fileName,
          fileType,
        },
      })
      return
    }

    isGeneratingDownload = true

    try {
      const mimeType = getMimeType(fileType)
      const quality = getQuality(fileType)

      const blob = await canvasToBlobWithWhiteBackground(
        resolvedCanvas,
        mimeType,
        quality
      )

      triggerDownload(blob, `${fileName}${fileType}`, '')
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Unknown error'

      errorService.report({
        origin: 'export',
        severity: 'recoverable',
        userMessage: `Failed to generate download: ${message}`,
        cause: error,
        context: {
          fileName,
          fileType,
          exportSourceKind: exportSource?.kind ?? null,
        },
      })
    } finally {
      isGeneratingDownload = false
    }
  }

  // Handle download button click
  function handleDownload() {
    generateDownload()
  }
</script>

<div class="preview-container">
  <!-- Container for the child component -->
  <div class="component-container" bind:this={componentContainer}>
    <!-- Preview area -->
    <div class="preview-wrapper">
      <svelte:boundary onerror={reportPreviewRenderError}>
        <div class="child-wrapper" style="background-color: white;">
          {@render children()}
        </div>

        {#snippet failed(error, reset)}
          <div class="preview-error-state">
            <p class="preview-error-copy">
              Preview could not be generated. You can retry without closing the
              dialog.
            </p>
            <p class="preview-error-detail">{getErrorMessage(error)}</p>
            <MajorButton
              onclick={() => retryPreview(reset)}
              size="sm"
              variant="secondary"
            >
              Retry preview
            </MajorButton>
          </div>
        {/snippet}
      </svelte:boundary>
    </div>

    <!-- Download button -->
    {#if showDownloadButton}
      <div class="preview-actions">
        <MajorButton
          onclick={handleDownload}
          isDisabled={isDownloadDisabled}
          variant="primary"
        >
          {#if previewRenderError !== null}
            Preview unavailable
          {:else if isGeneratingDownload}
            Generating {fileType.substring(1).toUpperCase()}...
          {:else}
            Download {fileName}{fileType}
          {/if}
        </MajorButton>
      </div>
    {/if}
  </div>
</div>

<style>
  .preview-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .child-wrapper {
    border: 1px dashed #ddd;
    width: fit-content;
    height: fit-content;
    pointer-events: none; /* Disable hover effects in download preview */
  }

  .preview-error-state {
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid #d6dce5;
    border-radius: 10px;
  }

  .preview-error-copy,
  .preview-error-detail {
    margin: 0;
    color: var(--c-text);
    line-height: 1.45;
    font-size: 0.9rem;
  }

  .preview-error-detail {
    color: var(--c-midgrey);
    overflow-wrap: anywhere;
  }

  .preview-wrapper {
    position: relative;
    border: 1px solid #ddd;
    overflow: auto;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin: 0.5rem 0;
    background-color: #f9f9f9;
    min-height: 200px;
    padding: 2rem;
    background-image:
      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
    background-size: 20px 20px;
    background-position:
      0 0,
      0 10px,
      10px -10px,
      -10px 0px;
  }

  .preview-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
  }
</style>
