<script lang="ts">
  import { setContext, tick } from 'svelte'
  import MajorButton from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { addErrorToast } from '$lib/toaster'
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

  // States
  let componentContainer = $state<HTMLElement | null>(null) // Container for the child component
  let isGeneratingDownload = $state(false)
  let exportSource = $state<ExportSource | null>(null)

  const registrar: ExportSourceRegistrar = {
    register: source => {
      exportSource = source
    },
  }

  setContext(EXPORT_SOURCE_CONTEXT, registrar)

  // Function to generate high-resolution download
  async function generateDownload() {
    await tick()

    const resolvedCanvas =
      exportSource?.kind === 'canvas' ? exportSource.getCanvas() : null

    if (!resolvedCanvas) {
      addErrorToast(
        'Nothing to export: plot did not register an export source.'
      )
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
    } catch (error: any) {
      console.error('Error generating download:', error)
      addErrorToast(
        `Failed to generate download: ${error.message || 'Unknown error'}`
      )
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
      <div class="child-wrapper" style="background-color: white;">
        {@render children()}
      </div>
    </div>

    <!-- Download button -->
    {#if showDownloadButton}
      <div class="preview-actions">
        <MajorButton
          onclick={handleDownload}
          isDisabled={isGeneratingDownload}
          variant="primary"
        >
          {isGeneratingDownload
            ? `Generating ${fileType.substring(1).toUpperCase()}...`
            : `Download ${fileName}${fileType}`}
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
