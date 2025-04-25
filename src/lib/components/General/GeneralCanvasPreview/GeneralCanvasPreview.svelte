<script lang="ts">
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { addErrorToast } from '$lib/stores/toastStore'
  import { onMount } from 'svelte'

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
  let isLoading = $state(true) // New state for initial loading

  // Function to generate high-resolution download
  async function generateDownload() {
    // Obtain through DOM - first canvas element inside the child wrapper
    const childCanvas = componentContainer?.querySelector('canvas')
    if (!childCanvas) return

    isGeneratingDownload = true

    try {
      // Convert to blob and download
      const mimeType = fileType === '.png' ? 'image/png' : 'image/jpeg'
      const quality = fileType === '.jpg' ? 0.95 : undefined

      const blob = await new Promise<Blob | null>(resolve => {
        childCanvas.toBlob(resolve, mimeType, quality)
      })

      if (!blob) throw new Error('Failed to create image blob')

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}${fileType}`
      document.body.appendChild(a)
      a.click()

      // Clean up
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
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

  // Initial render after component mounts
  onMount(() => {
    // Set loading state for 1 second
    setTimeout(() => {
      isLoading = false
    }, 1000)
  })
</script>

<div class="preview-container">
  <!-- Container for the child component -->
  <div class="component-container" bind:this={componentContainer}>
    <!-- Preview area -->
    <div class="preview-wrapper">
      {#if isLoading}
        <div class="loading-overlay">
          <div class="spinner"></div>
          <p>Loading preview...</p>
        </div>
      {:else}
        <div class="child-wrapper">
          {@render children()}
        </div>
      {/if}
    </div>

    <!-- Download button -->
    {#if showDownloadButton}
      <div class="preview-actions">
        <MajorButton
          onclick={handleDownload}
          isDisabled={isGeneratingDownload || isLoading}
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
    background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
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

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-weight: 500;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .preview-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    margin-bottom: 1.5rem;
  }
</style>
