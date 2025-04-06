<script lang="ts">
  import MajorButton from '../GeneralButton/GeneralButtonMajor.svelte'
  import { addErrorToast } from '$lib/stores/toastStore'
  import type { ComponentType, SvelteComponent } from 'svelte'

  // Component props
  interface Props {
    fileName: string
    fileType: string
    width: number
    height?: number
    onDownload?: () => void
    showDownloadButton?: boolean
    children: any // Using any to avoid type conflicts
    childProps?: Record<string, any>
  }

  let {
    fileName,
    fileType,
    width,
    height = 0,
    onDownload,
    showDownloadButton = false, // default to false for integrated view
    children,
    childProps = {},
  }: Props = $props()

  // States
  let sourceContainer = $state<HTMLElement | null>(null) // Hidden container to render the original component
  let svgContainer = $state<HTMLElement | null>(null) // Container to display extracted SVG
  let canvasPreview = $state<HTMLCanvasElement | null>(null)
  let convertingToCanvas = $state(false)
  let extractingSvg = $state(false)
  let svgExtracted = $state(false)
  let svgContent = $state<string>('')

  // Use a composite key that changes when any relevant prop changes
  const componentKey = $derived(
    `${width}-${fileType}-${JSON.stringify(childProps)}`
  )

  // Determine if we need to show the canvas preview (for non-SVG formats)
  const shouldShowCanvas = $derived(fileType !== '.svg')
  const displayHeight = $derived(height || 'auto')

  // Function to extract SVG from component when the container is available
  $effect(() => {
    if (sourceContainer && componentKey) {
      // Reset extraction state when key changes
      svgExtracted = false
      svgContent = ''

      // Delay extraction to ensure component has rendered
      setTimeout(extractSvgFromComponent, 250)
    }
  })

  // Function to render to canvas when needed (simpler than effect)
  $effect(() => {
    if (svgExtracted && shouldShowCanvas && canvasPreview) {
      renderSvgToCanvas()
    }
  })

  // Function to extract SVG from component
  async function extractSvgFromComponent() {
    if (!sourceContainer) return

    extractingSvg = true

    try {
      // Find the SVG element in the source container
      const svgElement = sourceContainer.querySelector('svg')
      if (!svgElement) {
        throw new Error('SVG element not found in component')
      }

      // Get the SVG content
      const svgData = new XMLSerializer().serializeToString(svgElement)

      // Store the SVG content
      svgContent = svgData

      // Update state
      svgExtracted = true
      extractingSvg = false

      // If we need canvas preview, renderSvgToCanvas will be called by the effect
    } catch (error) {
      console.error('Error extracting SVG from component', error)
      extractingSvg = false
      addErrorToast('Failed to extract SVG from component')
    }
  }

  // Function to convert SVG to canvas
  async function renderSvgToCanvas() {
    if (!svgContent || !canvasPreview || !svgExtracted) return

    convertingToCanvas = true

    try {
      // Create a blob URL from the SVG data
      const svgBlob = new Blob([svgContent], {
        type: 'image/svg+xml;charset=utf-8',
      })
      const url = URL.createObjectURL(svgBlob)

      // Create an image to load the SVG
      const img = new Image()
      img.onload = () => {
        // Check if canvasPreview is still available (could have been unmounted)
        if (!canvasPreview) {
          URL.revokeObjectURL(url)
          convertingToCanvas = false
          return
        }

        // Set canvas dimensions
        canvasPreview.width = width
        canvasPreview.height = height

        // Draw the image on the canvas
        const ctx = canvasPreview.getContext('2d')
        if (ctx) {
          // Clear canvas
          ctx.clearRect(0, 0, width, height)

          // Set background (for formats that don't support transparency)
          if (fileType === '.jpg') {
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, width, height)
          }

          // Draw the image
          ctx.drawImage(img, 0, 0, width, height)
          convertingToCanvas = false
        }

        // Clean up
        URL.revokeObjectURL(url)
      }

      img.onerror = error => {
        console.error('Error loading SVG image for canvas', error)
        convertingToCanvas = false
        addErrorToast('Failed to render preview in canvas')
      }

      img.src = url
    } catch (error) {
      console.error('Error rendering SVG to canvas', error)
      convertingToCanvas = false
      addErrorToast('Failed to render preview in canvas')
    }
  }

  function handleDownload() {
    // If custom download handler provided, use it
    if (onDownload) {
      onDownload()
      return
    }

    if (!svgContent) {
      return addErrorToast('No SVG content found to download')
    }

    try {
      // For non-SVG formats, download from canvas if available
      if (fileType !== '.svg' && canvasPreview) {
        canvasPreview.toBlob(
          blob => {
            if (!blob) throw new Error('Could not create blob from canvas')

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
          },
          fileType === '.jpg'
            ? 'image/jpeg'
            : fileType === '.png'
              ? 'image/png'
              : 'image/webp',
          0.95 // quality
        )
      } else {
        // SVG format - download the SVG content directly
        const svgBlob = new Blob([svgContent], {
          type: 'image/svg+xml;charset=utf-8',
        })
        const url = URL.createObjectURL(svgBlob)

        // Create download link
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileName}${fileType}`
        document.body.appendChild(a)
        a.click()

        // Clean up
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error downloading file', error)
      addErrorToast(`Failed to download ${fileType} file`)
    }
  }
</script>

<div class="preview-container">
  <!-- Hidden container to render the original component -->
  <div class="hidden-source" bind:this={sourceContainer}>
    <!-- Using componentKey to force re-render when relevant props change -->
    {#key componentKey}
      <svelte:component this={children} {...childProps} />
    {/key}
  </div>

  <div class="overflow-container">
    <div
      class="preview-wrapper"
      style="width: {width}px; height: {displayHeight};"
    >
      <!-- Extracted SVG preview (for SVG format) -->
      {#if !shouldShowCanvas && svgExtracted}
        <div class="svg-container" bind:this={svgContainer}>
          {@html svgContent}
        </div>
      {/if}

      <!-- Loading indicator for SVG extraction -->
      {#if extractingSvg}
        <div class="loading-overlay">
          <p>Preparing SVG preview...</p>
        </div>
      {/if}

      <!-- Canvas preview for non-SVG formats -->
      {#if shouldShowCanvas}
        <div class="canvas-container">
          <canvas bind:this={canvasPreview} {width} {height}></canvas>
          {#if convertingToCanvas}
            <div class="loading-overlay">
              <p>
                Converting to {fileType.substring(1).toUpperCase()} preview...
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if showDownloadButton}
    <div class="preview-actions">
      <MajorButton onclick={handleDownload}
        >Download {fileName}{fileType}</MajorButton
      >
    </div>
  {/if}
</div>

<style>
  .preview-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .preview-wrapper {
    position: relative;
    border: 1px solid #ddd;
    overflow: auto;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin: 0.5rem 0;
  }

  .svg-container,
  .canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .hidden-source {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
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

  canvas {
    display: block;
  }

  .preview-actions {
    display: flex;
    justify-content: start;
    margin-top: 0.5rem;
  }

  .overflow-container {
    overflow: auto;
    max-width: 100%;
    border: 1px dotted #ddd;
    padding: 0.5rem;
  }
</style>
