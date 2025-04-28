<script lang="ts">
  import MajorButton from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { addErrorToast } from '$lib/toaster'

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

      let exportCanvas = childCanvas

      // Only add white background for JPG
      if (fileType === '.jpg') {
        // Create a temporary canvas with white background
        const tempCanvas = document.createElement('canvas')
        const ctx = tempCanvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        // Set the same dimensions as the original canvas
        tempCanvas.width = childCanvas.width
        tempCanvas.height = childCanvas.height

        // Fill with white background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

        // Draw the original canvas content on top
        ctx.drawImage(childCanvas, 0, 0)
        exportCanvas = tempCanvas
      }

      const blob = await new Promise<Blob | null>(resolve => {
        exportCanvas.toBlob(resolve, mimeType, quality)
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
</script>

<div class="preview-container">
  <!-- Container for the child component -->
  <div class="component-container" bind:this={componentContainer}>
    <!-- Preview area -->
    <div class="preview-wrapper">
      <div
        class="child-wrapper"
        style="background-color: {fileType === '.jpg'
          ? 'white'
          : 'transparent'};"
      >
        {@render children()}
      </div>
    </div>

    <!-- Download button -->
    {#if showDownloadButton}
      <div class="preview-actions">
        <MajorButton onclick={handleDownload} isDisabled={isGeneratingDownload}>
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

  .preview-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    margin-bottom: 1.5rem;
  }
</style>
