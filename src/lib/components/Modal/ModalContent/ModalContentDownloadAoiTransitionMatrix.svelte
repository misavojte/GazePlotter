<script lang="ts">
  import DownloadPlotSettings from '$lib/components/Modal/Shared/DownloadPlotSettings.svelte'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'
  import AoiTransitionMatrixPlotFigure from '$lib/components/Plot/AoiTransitionMatrixPlot/AoiTransitionMatrixPlotFigure.svelte'
  import type { SvelteComponent } from 'svelte'
  import {
    calculateTransitionMatrix,
    AggregationMethod,
  } from '$lib/utils/aoiTransitionMatrixTransformations'
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { addErrorToast, addSuccessToast } from '$lib/stores/toastStore'
  import { onMount } from 'svelte'

  interface Props {
    settings: AoiTransitionMatrixGridType
  }

  let { settings }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.svg' | '.png' | '.jpg' | '.webp'>('.png')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-AoiTransitionMatrix')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // States for preview
  let previewContainer = $state<HTMLDivElement | null>(null)
  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasCtx = $state<CanvasRenderingContext2D | null>(null)
  let isRendering = $state(false)

  // Calculate matrix data for preview
  const { matrix, aoiLabels } = $derived(
    calculateTransitionMatrix(
      settings.stimulusId,
      settings.groupId,
      settings.aggregationMethod as AggregationMethod
    )
  )

  // Get current stimulus-specific color range or use default values
  const currentStimulusColorRange = $derived.by(() => {
    const stimulusId = settings.stimulusId
    return settings.stimuliColorValueRanges?.[stimulusId] || [0, 0]
  })

  // Calculate the effective width (what will be available for the chart after margins)
  const effectiveWidth = $derived(width - (marginLeft + marginRight))

  // Use the height directly from the data with additional space for legend and axes
  // Add fixed padding (150px) plus margins to maintain proper spacing
  const previewHeight = $derived(
    effectiveWidth + 150 // Square matrix + legend
  )

  // Props to pass to the AoiTransitionMatrixPlotFigure component
  const matrixPlotProps = $derived({
    AoiTransitionMatrix: matrix,
    aoiLabels,
    width: effectiveWidth,
    height: effectiveWidth,
    cellSize: 30,
    colorScale: settings.colorScale,
    xLabel: 'To AOI',
    yLabel: 'From AOI',
    legendTitle: getLegendTitle(settings.aggregationMethod),
    colorValueRange: currentStimulusColorRange,
    belowMinColor: settings.belowMinColor,
    aboveMaxColor: settings.aboveMaxColor,
    showBelowMinLabels: settings.showBelowMinLabels,
    showAboveMaxLabels: settings.showAboveMaxLabels,
  })

  // Update the legend title based on the aggregation method
  function getLegendTitle(method: string): string {
    switch (method) {
      case AggregationMethod.SUM:
        return 'Transition Count'
      case AggregationMethod.PROBABILITY:
        return 'Transition Probability (%)'
      case AggregationMethod.DWELL_TIME:
        return 'Dwell Time (ms)'
      case AggregationMethod.SEGMENT_DWELL_TIME:
        return 'Segment Dwell Time (ms)'
      default:
        return 'Transition Value'
    }
  }

  // Setup canvas rendering
  function setupCanvas() {
    if (!canvas) return

    // Get the canvas context
    canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) return

    // Set the canvas dimensions
    canvas.width = width
    canvas.height = previewHeight

    // Set the display size
    canvas.style.width = `${width}px`
    canvas.style.height = `${previewHeight}px`

    // Render the plot
    renderPlot()
  }

  // Function to render the plot to the canvas
  function renderPlot() {
    if (!canvasCtx || !canvas) return

    isRendering = true

    // Clear the canvas
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply margins
    canvasCtx.translate(marginLeft, marginTop)

    // Create a temporary canvas to render the plot
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = effectiveWidth
    tempCanvas.height = previewHeight - marginTop - marginBottom

    // Append to DOM temporarily to allow rendering
    tempCanvas.style.position = 'absolute'
    tempCanvas.style.left = '-9999px'
    tempCanvas.style.top = '-9999px'
    document.body.appendChild(tempCanvas)

    // Create a wrapper for the plot component
    const plotWrapper = document.createElement('div')
    plotWrapper.style.width = `${effectiveWidth}px`
    plotWrapper.style.height = `${previewHeight - marginTop - marginBottom}px`
    document.body.appendChild(plotWrapper)

    // Add background if jpg
    if (typeOfExport === '.jpg') {
      canvasCtx.fillStyle = 'white'
      canvasCtx.fillRect(-marginLeft, -marginTop, width, previewHeight)
    }

    // Create the component
    try {
      // Create the component directly in the DOM
      const componentContainer = document.createElement('div')
      componentContainer.style.width = `${effectiveWidth}px`
      componentContainer.style.height = `${previewHeight - marginTop - marginBottom}px`
      plotWrapper.appendChild(componentContainer)

      // Create a placeholder element to mimic the component's canvas
      const componentCanvas = document.createElement('canvas')
      componentCanvas.width = effectiveWidth
      componentCanvas.height = previewHeight - marginTop - marginBottom
      componentContainer.appendChild(componentCanvas)

      // Create a context for drawing
      const ctx = componentCanvas.getContext('2d')
      if (ctx) {
        // Draw a representation of what would be in the matrix plot
        ctx.fillStyle = 'white'
        ctx.fillRect(
          0,
          0,
          effectiveWidth,
          previewHeight - marginTop - marginBottom
        )

        // Draw grid lines to represent the matrix
        const cellSize =
          Math.min(effectiveWidth, previewHeight - marginTop - marginBottom) /
          aoiLabels.length
        ctx.strokeStyle = '#ddd'
        ctx.lineWidth = 0.5

        // Draw cells
        for (let row = 0; row < aoiLabels.length; row++) {
          for (let col = 0; col < aoiLabels.length; col++) {
            const value = matrix[row]?.[col] ?? 0

            // Determine cell color
            let cellColor = '#f0f0f0'
            if (value > 0) {
              // Use a simple gradient representation
              const normalizedValue = Math.min(
                1,
                value / (currentStimulusColorRange[1] || 1)
              )
              const r = Math.round(255 - normalizedValue * 200)
              const g = Math.round(255 - normalizedValue * 200)
              const b = Math.round(255)
              cellColor = `rgb(${r}, ${g}, ${b})`
            }

            // Draw cell
            ctx.fillStyle = cellColor
            ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
            ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize)

            // Add text if value is significant
            if (value > 0) {
              ctx.fillStyle = 'black'
              ctx.font = '10px sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(
                value.toString(),
                col * cellSize + cellSize / 2,
                row * cellSize + cellSize / 2
              )
            }
          }
        }

        // Draw the component canvas onto our preview canvas
        canvasCtx!.drawImage(
          componentCanvas,
          0,
          0,
          effectiveWidth,
          previewHeight - marginTop - marginBottom
        )
      }

      // Clean up
      document.body.removeChild(plotWrapper)
      document.body.removeChild(tempCanvas)
      canvasCtx!.translate(-marginLeft, -marginTop)
      isRendering = false
    } catch (error) {
      console.error('Error creating preview:', error)
      addErrorToast('Failed to create preview')
      document.body.removeChild(plotWrapper)
      document.body.removeChild(tempCanvas)
      canvasCtx!.translate(-marginLeft, -marginTop)
      isRendering = false
    }
  }

  // Download the canvas as an image
  function downloadCanvas() {
    if (!canvas) return

    try {
      // Create a new canvas with proper DPI for export
      const exportCanvas = document.createElement('canvas')

      // Calculate dimensions with DPI
      const dpiScale = dpi / 96
      exportCanvas.width = Math.ceil(width * dpiScale)
      exportCanvas.height = Math.ceil(previewHeight * dpiScale)

      const exportCtx = exportCanvas.getContext('2d')
      if (!exportCtx) {
        addErrorToast('Failed to create export context')
        return
      }

      // Set background for jpg
      if (typeOfExport === '.jpg') {
        exportCtx.fillStyle = 'white'
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
      }

      // Scale for DPI
      exportCtx.scale(dpiScale, dpiScale)

      // Draw the preview canvas to the export canvas
      exportCtx.drawImage(canvas, 0, 0, width, previewHeight)

      // Convert to blob and download
      exportCanvas.toBlob(
        blob => {
          if (!blob) {
            addErrorToast('Failed to create image file')
            return
          }

          // Create object URL
          const url = URL.createObjectURL(blob)

          // Create download link
          const link = document.createElement('a')
          link.href = url
          link.download = `${fileName}${typeOfExport}`
          link.click()

          // Clean up
          URL.revokeObjectURL(url)
          addSuccessToast('Download complete!')
        },
        typeOfExport === '.jpg'
          ? 'image/jpeg'
          : typeOfExport === '.png'
            ? 'image/png'
            : typeOfExport === '.webp'
              ? 'image/webp'
              : 'image/png'
      )
    } catch (error) {
      console.error('Download error:', error)
      addErrorToast('Download failed')
    }
  }

  // Watch for changes that require re-rendering
  $effect(() => {
    if (canvas && canvasCtx) {
      // Any of these changes should trigger a re-render
      const key =
        `${width}-${previewHeight}-${marginLeft}-${marginRight}-${marginTop}-${marginBottom}-${effectiveWidth}-${typeOfExport}-${dpi}` +
        `${settings.stimulusId}-${settings.groupId}-${settings.aggregationMethod}-${JSON.stringify(currentStimulusColorRange)}`

      // Reset and redraw
      canvas.width = width
      canvas.height = previewHeight
      canvas.style.width = `${width}px`
      canvas.style.height = `${previewHeight}px`

      renderPlot()
    }
  })

  onMount(() => {
    setupCanvas()
  })
</script>

<div class="single-view-container">
  <!-- Settings Section using shared component -->
  <DownloadPlotSettings
    bind:typeOfExport
    bind:width
    bind:fileName
    bind:dpi
    bind:marginTop
    bind:marginRight
    bind:marginBottom
    bind:marginLeft
    allowNegativeMargins={true}
  />

  <!-- Preview Section -->
  <div class="preview-section">
    <div class="preview-heading">
      <h3>Your exported plot</h3>
    </div>
    <div class="canvas-container" bind:this={previewContainer}>
      <canvas bind:this={canvas}></canvas>
      {#if isRendering}
        <div class="rendering-overlay">
          <p>Rendering preview...</p>
        </div>
      {/if}
    </div>
    <div class="download-button">
      <MajorButton onclick={downloadCanvas} isDisabled={isRendering}>
        Download as {typeOfExport.substring(1).toUpperCase()}
      </MajorButton>
    </div>
  </div>
</div>

<style>
  .single-view-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-height: 80vh;
    max-width: 830px;
  }

  .preview-heading h3 {
    margin-top: 0;
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .preview-section {
    flex-grow: 1;
    overflow: auto;
  }

  .canvas-container {
    position: relative;
    margin-bottom: 1rem;
    border: 1px solid #ddd;
    overflow: hidden;
  }

  .rendering-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .download-button {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
  }

  /* Responsive layout for wider screens */
  @media (min-width: 768px) {
    .single-view-container {
      max-height: none;
    }
  }

  /* Mobile layout adjustments */
  @media (max-width: 600px) {
    .preview-section {
      overflow-x: auto;
    }
  }
</style>
