<script lang="ts">
  import MajorButton from '../GeneralButton/GeneralButtonMajor.svelte'
  import { addErrorToast } from '$lib/stores/toastStore'

  // Component props
  interface Props {
    fileName: string
    fileType: string
    width: number
    height?: number
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
    dpi?: number // Add DPI property for canvas exports
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
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
    dpi = 96, // Default web DPI
    onDownload,
    showDownloadButton = false, // default to false for integrated view
    children,
    childProps = {},
  }: Props = $props()

  // States
  let sourceContainer = $state<HTMLElement | null>(null) // Hidden container to render the original component
  let svgContainer = $state<HTMLElement | null>(null) // Container to display extracted SVG
  let canvasPreview = $state<HTMLCanvasElement | null>(null) // Visual preview canvas
  let convertingToCanvas = $state(false)
  let extractingSvg = $state(false)
  let svgExtracted = $state(false)
  let svgContent = $state<string>('')
  let originalSvgContent = $state<string>('')

  // Use a composite key that changes when any relevant prop changes
  const componentKey = $derived(
    `${width}-${fileType}-${marginTop}-${marginRight}-${marginBottom}-${marginLeft}-${dpi}-${JSON.stringify(childProps)}`
  )

  // Determine if we need to show the canvas preview (for non-SVG formats)
  const shouldShowCanvas = $derived(fileType !== '.svg')
  const displayHeight = $derived(height ? height + 'px' : 'auto')

  // Calculate the effective dimensions for the content (adjusted for margins)
  const effectiveWidth = $derived(width - (marginLeft + marginRight))
  const effectiveHeight = $derived(
    height ? height - (marginTop + marginBottom) : 0
  )

  // Calculate final output dimensions
  const outputHeight = $derived(
    height || effectiveHeight + marginTop + marginBottom
  )

  // Adjust child props to account for margins
  const adjustedChildProps = $derived({
    ...childProps,
    chartWidth: effectiveWidth, // Override chartWidth if it exists
  })

  // Function to extract SVG from component when the container is available
  $effect(() => {
    if (sourceContainer && componentKey) {
      // Reset extraction state when key changes
      svgExtracted = false
      svgContent = ''
      originalSvgContent = ''

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

      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement

      // Store the original SVG content (for reference if needed)
      originalSvgContent = new XMLSerializer().serializeToString(svgElement)

      // Apply margins to the SVG by adjusting the viewBox
      // If viewBox exists, parse it
      let viewBox = clonedSvg.getAttribute('viewBox')
      let vbValues = viewBox
        ? viewBox.split(' ').map(v => parseFloat(v))
        : [0, 0, effectiveWidth, effectiveHeight]

      // Create a new viewBox that accounts for directional margins
      // Negative margins crop the content (move viewBox inward)
      // Positive margins add space (move viewBox outward)
      const newViewBox = `${vbValues[0] - marginLeft} ${vbValues[1] - marginTop} ${vbValues[2] + marginLeft + marginRight} ${vbValues[3] + marginTop + marginBottom}`
      clonedSvg.setAttribute('viewBox', newViewBox)

      // Ensure width and height are set correctly for the final output dimensions
      clonedSvg.setAttribute('width', `${width}`)
      clonedSvg.setAttribute('height', `${outputHeight}`)

      // Get the modified SVG content
      svgContent = new XMLSerializer().serializeToString(clonedSvg)

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

        // Important: Set CSS width and height for display
        // This controls the physical size that appears on screen
        canvasPreview.style.width = width + 'px'
        canvasPreview.style.height = outputHeight + 'px'

        // Calculate DPI scale (relative to 96 DPI standard)
        const dpiScale = dpi / 96

        // Set canvas DOM dimensions for the desired DPI
        // This controls the pixel density (resolution)
        canvasPreview.width = Math.ceil(width * dpiScale)
        canvasPreview.height = Math.ceil(outputHeight * dpiScale)

        // Get context and prepare for drawing
        const ctx = canvasPreview.getContext('2d')
        if (ctx) {
          // Clear the canvas
          ctx.clearRect(0, 0, canvasPreview.width, canvasPreview.height)

          // Set a white background for formats that don't support transparency
          if (fileType === '.jpg') {
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvasPreview.width, canvasPreview.height)
          }

          // Scale the context to match the DPI
          // This ensures consistent drawing coordinates regardless of DPI
          ctx.scale(dpiScale, dpiScale)

          // Draw the image at the original dimensions
          // Since the context is scaled, this preserves the physical size
          // while increasing the pixel density
          ctx.drawImage(img, 0, 0, width, outputHeight)

          console.log(
            `Canvas set to ${canvasPreview.width}x${canvasPreview.height} pixels (${dpiScale}x scale) for ${dpi} DPI`
          )
          console.log(
            `Physical dimensions preserved at ${width}x${outputHeight}px`
          )
        }

        convertingToCanvas = false

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
        getBlobForDownload(fileType, fileType === '.jpg' ? 0.95 : 1.0)
          .then(blob => {
            // Calculate file size for logging
            const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2)
            const { physicalWidth, physicalHeight } = getPhysicalDimensions()

            console.log(
              `Exporting ${fileType} file at ${dpi} DPI (${fileSizeMB} MB)`
            )
            console.log(
              `Physical size: ${physicalWidth.toFixed(2)}in × ${physicalHeight.toFixed(2)}in`
            )

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
          })
          .catch(error => {
            console.error('Error creating download blob:', error)
            addErrorToast(`Failed to process ${fileType} file for download`)
          })
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

  // Returns a Blob for download with updated DPI metadata and dimensions.
  async function getBlobForDownload(
    fileType: string,
    quality: number = 0.95
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!canvasPreview) {
        reject(new Error('Canvas not available'))
        return
      }
      createHighResolutionImage(canvasPreview, dpi, fileType, quality)
        .then(async blob => {
          if (!blob) throw new Error('Failed to create high-resolution blob')
          try {
            const arrayBuffer = await blob.arrayBuffer()
            let blobWithDpi
            if (fileType === '.jpg') {
              blobWithDpi = metadataUtils.addDpiToJpeg(arrayBuffer, dpi)
              console.log(`JPEG metadata: DPI set to ${dpi}`)
            } else if (fileType === '.png') {
              blobWithDpi = metadataUtils.addDpiToPng(arrayBuffer, dpi)
              console.log(`PNG metadata: DPI set to ${dpi}`)
            } else {
              blobWithDpi = blob
            }
            resolve(blobWithDpi)
          } catch (error) {
            console.error(`Error adding DPI metadata to ${fileType}:`, error)
            console.log('Falling back to original blob without DPI metadata')
            resolve(blob)
          }
        })
        .catch(error => {
          console.error('Error in high-resolution export:', error)
          fallbackExport()
        })

      function fallbackExport() {
        if (!canvasPreview) {
          reject(new Error('Canvas not available for fallback export'))
          return
        }
        const mimeType =
          fileType === '.jpg'
            ? 'image/jpeg'
            : fileType === '.png'
              ? 'image/png'
              : 'image/svg+xml;charset=utf-8'
        canvasPreview.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'))
              return
            }
            console.log('Using fallback export method (standard resolution)')
            resolve(blob)
          },
          mimeType,
          fileType === '.jpg' ? quality : undefined
        )
      }
    })
  }

  // Creates a high-resolution image by scaling the canvas to the target DPI.
  async function createHighResolutionImage(
    sourceCanvas: HTMLCanvasElement,
    targetDpi: number,
    fileType: string,
    quality: number = 0.95
  ): Promise<Blob> {
    const { physicalWidth, physicalHeight } = getPhysicalDimensions()
    const pixelWidth = Math.round(physicalWidth * targetDpi)
    const pixelHeight = Math.round(physicalHeight * targetDpi)

    const hiResCanvas = document.createElement('canvas')
    hiResCanvas.width = pixelWidth
    hiResCanvas.height = pixelHeight

    const ctx = hiResCanvas.getContext('2d')
    if (!ctx)
      throw new Error('Failed to get context for high-resolution canvas')

    ctx.clearRect(0, 0, hiResCanvas.width, hiResCanvas.height)
    if (fileType === '.jpg') {
      // For JPG, fill background with white.
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, hiResCanvas.width, hiResCanvas.height)
    }

    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      pixelWidth,
      pixelHeight
    )

    return new Promise((resolve, reject) => {
      const mimeType =
        fileType === '.jpg'
          ? 'image/jpeg'
          : fileType === '.png'
            ? 'image/png'
            : 'image/svg+xml;charset=utf-8'
      hiResCanvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error(`Failed to create ${fileType} blob`))
            return
          }
          resolve(blob)
        },
        mimeType,
        fileType === '.jpg' ? quality : undefined
      )
    })
  }

  // Utility functions to modify DPI metadata.
  const metadataUtils = {
    addDpiToJpeg(jpegArrayBuffer: ArrayBuffer, dpi: number): Blob {
      const dataView = new DataView(jpegArrayBuffer)
      const uint8Array = new Uint8Array(jpegArrayBuffer)
      if (dataView.getUint8(0) !== 0xff || dataView.getUint8(1) !== 0xd8) {
        console.warn('Not a valid JPEG file (missing JPEG SOI marker)')
        return new Blob([uint8Array], { type: 'image/jpeg' })
      }

      const { physicalWidth, physicalHeight } = getPhysicalDimensions()
      const targetWidth = Math.round(physicalWidth * dpi)
      const targetHeight = Math.round(physicalHeight * dpi)

      // Build a new JFIF APP0 marker with the correct DPI.
      const jfifData = new Uint8Array([
        0xff,
        0xe0,
        0x00,
        0x10,
        0x4a,
        0x46,
        0x49,
        0x46,
        0x00,
        0x01,
        0x01,
        0x01,
        (dpi >> 8) & 0xff,
        dpi & 0xff,
        (dpi >> 8) & 0xff,
        dpi & 0xff,
        0x00,
        0x00,
      ])

      let appMarkerIndex = 2
      let hasJfifMarker = false
      if (
        appMarkerIndex + 1 < uint8Array.length &&
        uint8Array[appMarkerIndex] === 0xff &&
        uint8Array[appMarkerIndex + 1] === 0xe0
      ) {
        hasJfifMarker = true
        const markerLength =
          (uint8Array[appMarkerIndex + 2] << 8) + uint8Array[appMarkerIndex + 3]
        console.log(`Found existing JFIF marker, length: ${markerLength} bytes`)
      }

      let resultArray: Uint8Array
      if (hasJfifMarker) {
        const markerLength =
          (uint8Array[appMarkerIndex + 2] << 8) + uint8Array[appMarkerIndex + 3]
        const existingMarkerTotalLength = markerLength + 2
        resultArray = new Uint8Array(
          uint8Array.length - existingMarkerTotalLength + jfifData.length
        )
        resultArray.set(uint8Array.subarray(0, 2), 0)
        resultArray.set(jfifData, 2)
        resultArray.set(
          uint8Array.subarray(2 + existingMarkerTotalLength),
          2 + jfifData.length
        )
      } else {
        resultArray = new Uint8Array(uint8Array.length + jfifData.length)
        resultArray.set(uint8Array.subarray(0, 2), 0)
        resultArray.set(jfifData, 2)
        resultArray.set(uint8Array.subarray(2), 2 + jfifData.length)
      }

      // Update the SOF marker dimensions.
      let foundSOF = false
      let i = 2
      while (i < resultArray.length - 8) {
        if (
          resultArray[i] === 0xff &&
          resultArray[i + 1] >= 0xc0 &&
          resultArray[i + 1] <= 0xcf &&
          resultArray[i + 1] !== 0xc4 &&
          resultArray[i + 1] !== 0xc8
        ) {
          foundSOF = true
          console.log(`Found SOF marker at position ${i}, updating dimensions`)
          resultArray[i + 5] = (targetHeight >> 8) & 0xff
          resultArray[i + 6] = targetHeight & 0xff
          resultArray[i + 7] = (targetWidth >> 8) & 0xff
          resultArray[i + 8] = targetWidth & 0xff
          break
        }
        i++
      }
      if (!foundSOF) {
        console.warn(
          'Could not find SOF marker to update dimensions. Only DPI metadata was set.'
        )
      }
      return new Blob([resultArray], { type: 'image/jpeg' })
    },

    addDpiToPng(pngArrayBuffer: ArrayBuffer, dpi: number): Blob {
      const uint8Array = new Uint8Array(pngArrayBuffer)
      const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      for (let i = 0; i < PNG_SIGNATURE.length; i++) {
        if (uint8Array[i] !== PNG_SIGNATURE[i]) {
          console.warn('Not a valid PNG file (invalid signature)')
          return new Blob([uint8Array], { type: 'image/png' })
        }
      }

      const { physicalWidth, physicalHeight } = getPhysicalDimensions()
      const targetWidth = Math.round(physicalWidth * dpi)
      const targetHeight = Math.round(physicalHeight * dpi)
      const pixelsPerMeter = Math.round(dpi / 0.0254)

      const physChunkData = new Uint8Array([
        0,
        0,
        0,
        9,
        0x70,
        0x48,
        0x59,
        0x73,
        (pixelsPerMeter >> 24) & 0xff,
        (pixelsPerMeter >> 16) & 0xff,
        (pixelsPerMeter >> 8) & 0xff,
        pixelsPerMeter & 0xff,
        (pixelsPerMeter >> 24) & 0xff,
        (pixelsPerMeter >> 16) & 0xff,
        (pixelsPerMeter >> 8) & 0xff,
        pixelsPerMeter & 0xff,
        1,
      ])

      const crc = metadataUtils.calculatePngCrc(physChunkData.subarray(4, 17))
      const crcBytes = new Uint8Array([
        (crc >> 24) & 0xff,
        (crc >> 16) & 0xff,
        (crc >> 8) & 0xff,
        crc & 0xff,
      ])

      const fullChunk = new Uint8Array(physChunkData.length + crcBytes.length)
      fullChunk.set(physChunkData, 0)
      fullChunk.set(crcBytes, physChunkData.length)

      // Update IHDR dimensions if possible.
      let modifiedData = uint8Array
      if (uint8Array.length >= 24) {
        if (
          uint8Array[12] === 0x49 &&
          uint8Array[13] === 0x48 &&
          uint8Array[14] === 0x44 &&
          uint8Array[15] === 0x52
        ) {
          const outputTemp = new Uint8Array(uint8Array.length)
          outputTemp.set(uint8Array)
          outputTemp[16] = (targetWidth >> 24) & 0xff
          outputTemp[17] = (targetWidth >> 16) & 0xff
          outputTemp[18] = (targetWidth >> 8) & 0xff
          outputTemp[19] = targetWidth & 0xff
          outputTemp[20] = (targetHeight >> 24) & 0xff
          outputTemp[21] = (targetHeight >> 16) & 0xff
          outputTemp[22] = (targetHeight >> 8) & 0xff
          outputTemp[23] = targetHeight & 0xff
          // Recalculate IHDR CRC
          const ihdrCrc = metadataUtils.calculatePngCrc(
            outputTemp.subarray(12, 29)
          )
          outputTemp[29] = (ihdrCrc >> 24) & 0xff
          outputTemp[30] = (ihdrCrc >> 16) & 0xff
          outputTemp[31] = (ihdrCrc >> 8) & 0xff
          outputTemp[32] = ihdrCrc & 0xff
          modifiedData = outputTemp
        }
      }

      // Insert or replace the pHYs chunk.
      let output
      let hasPhysChunk = false
      let physChunkPos = -1
      let pos = 33
      while (pos < modifiedData.length - 12) {
        const length =
          (modifiedData[pos] << 24) |
          (modifiedData[pos + 1] << 16) |
          (modifiedData[pos + 2] << 8) |
          modifiedData[pos + 3]
        if (
          modifiedData[pos + 4] === 0x70 &&
          modifiedData[pos + 5] === 0x48 &&
          modifiedData[pos + 6] === 0x59 &&
          modifiedData[pos + 7] === 0x73
        ) {
          hasPhysChunk = true
          physChunkPos = pos
          break
        }
        pos += 12 + length
      }

      if (hasPhysChunk) {
        const existingLength =
          (modifiedData[physChunkPos] << 24) |
          (modifiedData[physChunkPos + 1] << 16) |
          (modifiedData[physChunkPos + 2] << 8) |
          modifiedData[physChunkPos + 3]
        const existingChunkSize = 12 + existingLength
        output = new Uint8Array(
          modifiedData.length - existingChunkSize + fullChunk.length
        )
        output.set(modifiedData.subarray(0, physChunkPos))
        output.set(fullChunk, physChunkPos)
        output.set(
          modifiedData.subarray(physChunkPos + existingChunkSize),
          physChunkPos + fullChunk.length
        )
      } else {
        output = new Uint8Array(modifiedData.length + fullChunk.length)
        output.set(modifiedData.subarray(0, 33))
        output.set(fullChunk, 33)
        output.set(modifiedData.subarray(33), 33 + fullChunk.length)
      }
      return new Blob([output], { type: 'image/png' })
    },

    calculatePngCrc(data: Uint8Array): number {
      let crc = 0xffffffff
      const crcTable: number[] = []
      for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        }
        crcTable[n] = c
      }
      for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
      }
      return crc ^ 0xffffffff
    },
  }

  // Computes the physical dimensions (in inches) based on standard 96 DPI.
  function getPhysicalDimensions() {
    // 'width' and 'outputHeight' are assumed to be defined in the parent scope (CSS pixels).
    const physicalWidth = width / 96
    const physicalHeight = outputHeight / 96
    return { physicalWidth, physicalHeight }
  }
</script>

<div class="preview-container">
  <!-- Hidden container to render the original component -->
  <div class="hidden-source" bind:this={sourceContainer}>
    <!-- Using componentKey to force re-render when relevant props change -->
    {#key componentKey}
      <svelte:component this={children} {...adjustedChildProps} />
    {/key}
  </div>

  <div class="overflow-container">
    <div
      class="preview-wrapper"
      style="width: {width}px; min-height: {displayHeight};"
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
          <canvas bind:this={canvasPreview}></canvas>
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
    max-width: 100%;
    height: auto;
  }

  .preview-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }

  .dpi-info {
    font-size: 0.8rem;
    color: #666;
  }

  .dpi-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .dpi-label,
  .physical-size {
    white-space: nowrap;
  }

  .overflow-container {
    overflow: auto;
    max-width: 100%;
    border: 1px dotted #ddd;
    padding: 0.5rem;
  }
</style>
