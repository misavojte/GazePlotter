<script lang="ts">
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { addErrorToast } from '$lib/stores/toastStore'
  import { onMount } from 'svelte'

  // Component props
  interface Props {
    fileName: string
    fileType: '.png' | '.jpg'
    width: number
    height?: number
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
    dpi?: number
    onDownload?: () => void
    showDownloadButton?: boolean
    children: any // Child component that renders to Canvas
  }

  let {
    fileName,
    fileType,
    width,
    height = 0,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
    dpi = 96, // Default web DPI
    onDownload,
    showDownloadButton = false,
    children,
  }: Props = $props()

  // States
  let componentContainer = $state<HTMLElement | null>(null) // Container for the child component
  let previewCanvas = $state<HTMLCanvasElement | null>(null) // Canvas for preview display
  let downloadCanvas = $state<HTMLCanvasElement | null>(null) // Hidden canvas for high-resolution download

  let renderedChildComponent = $state<any>(null) // Reference to the rendered child component
  let childCanvas = $state<HTMLCanvasElement | null>(null) // The canvas element inside the child component

  let isRenderingPreview = $state(false)
  let isGeneratingDownload = $state(false)
  let previewReady = $state(false)

  // Calculate effective dimensions
  const effectiveWidth = $derived(width - (marginLeft + marginRight))
  const effectiveHeight = $derived(
    height ? height - (marginTop + marginBottom) : 0
  )

  // Detect child component changes that require re-rendering
  const componentKey = $derived(
    `${width}-${height}-${marginTop}-${marginRight}-${marginBottom}-${marginLeft}-${dpi}-${fileType}`
  )

  // Function to render the child component to the preview canvas
  async function renderPreview() {
    if (!componentContainer || !previewCanvas) return

    isRenderingPreview = true
    previewReady = false

    try {
      // Wait for the next tick to ensure child component is rendered
      await new Promise(resolve => setTimeout(resolve, 100))

      // Find the canvas inside the child component
      childCanvas = componentContainer.querySelector('canvas')
      if (!childCanvas) {
        throw new Error('No canvas element found in child component')
      }

      // Set dimensions for the preview canvas
      previewCanvas.width = width
      previewCanvas.height =
        height || childCanvas.height * (width / childCanvas.width)

      // Get the context and clear it
      const ctx = previewCanvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      // Clear the canvas
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)

      // For JPG background, fill with white
      if (fileType === '.jpg') {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height)
      }

      // Draw child canvas with margins applied
      ctx.drawImage(
        childCanvas,
        marginLeft,
        marginTop,
        effectiveWidth,
        effectiveHeight
      )

      previewReady = true
    } catch (error: any) {
      console.error('Error rendering preview:', error)
      addErrorToast(
        `Failed to render preview: ${error.message || 'Unknown error'}`
      )
    } finally {
      isRenderingPreview = false
    }
  }

  // Function to generate high-resolution download
  async function generateDownload() {
    if (!childCanvas) return

    isGeneratingDownload = true

    try {
      // Create a temporary canvas for high-resolution export
      const tempCanvas = document.createElement('canvas')

      // Calculate dimensions based on DPI
      const dpiScale = dpi / 96
      tempCanvas.width = Math.ceil(width * dpiScale)
      tempCanvas.height = Math.ceil(height * dpiScale)

      const ctx = tempCanvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      // Clear the canvas
      ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height)

      // For JPG, fill with white background
      if (fileType === '.jpg') {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
      }

      // Scale the context to match the DPI
      ctx.scale(dpiScale, dpiScale)

      // Draw with margins applied
      ctx.drawImage(
        childCanvas,
        marginLeft,
        marginTop,
        effectiveWidth,
        effectiveHeight
      )

      // Convert to blob and download
      const mimeType = fileType === '.png' ? 'image/png' : 'image/jpeg'
      const quality = fileType === '.jpg' ? 0.95 : undefined

      const blob = await new Promise<Blob | null>(resolve => {
        tempCanvas.toBlob(resolve, mimeType, quality)
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
    // If custom download handler provided, use it
    if (onDownload) {
      onDownload()
      return
    }

    generateDownload()
  }

  // Re-render when component key changes
  $effect(() => {
    if (componentKey && componentContainer) {
      renderPreview()
    }
  })

  // Initial render after component mounts
  onMount(() => {
    if (componentContainer) {
      // Delay initial render to ensure child component is mounted
      setTimeout(renderPreview, 200)
    }
  })
</script>

<div class="preview-container">
  <!-- Container for the child component -->
  <div class="component-container" bind:this={componentContainer}>
    <!-- Using componentKey to force re-render when relevant props change -->
    {#key componentKey}
      <div
        class="child-wrapper"
        style="width: {effectiveWidth}px; height: {effectiveHeight ||
          'auto'}px;"
      >
        {@render children()}
      </div>
    {/key}
  </div>

  <!-- Preview area -->
  <div class="preview-wrapper">
    <canvas
      bind:this={previewCanvas}
      {width}
      {height}
      class:hidden={!previewReady}
    ></canvas>

    <!-- Loading indicator -->
    {#if isRenderingPreview}
      <div class="loading-overlay">
        <p>Preparing {fileType.substring(1).toUpperCase()} preview...</p>
      </div>
    {/if}
  </div>

  <!-- Download button -->
  {#if showDownloadButton}
    <div class="preview-actions">
      <MajorButton
        onclick={handleDownload}
        isDisabled={isGeneratingDownload || !previewReady}
      >
        {isGeneratingDownload
          ? `Generating ${fileType.substring(1).toUpperCase()}...`
          : `Download ${fileName}${fileType}`}
      </MajorButton>
    </div>
  {/if}
</div>

<style>
  .preview-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .component-container {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .child-wrapper {
    position: relative;
  }

  .preview-wrapper {
    position: relative;
    border: 1px solid #ddd;
    overflow: auto;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin: 0.5rem 0;
    background-color: #f9f9f9;
  }

  canvas {
    display: block;
    max-width: 100%;
    height: auto;
    transition: opacity 0.2s;
  }

  canvas.hidden {
    opacity: 0;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 500;
  }

  .preview-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }
</style>
