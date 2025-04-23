<script lang="ts">
  import AoiTransitionMatrixLegend from '$lib/components/Plot/AoiTransitionMatrixPlot/AoiTransitionMatrixLegend.svelte'
  import { getColorForValue, getContrastTextColor } from '$lib/utils/colorUtils'
  import { updateTooltip } from '$lib/stores/tooltipStore'
  import { calculateLabelOffset } from '../utils/textUtils'
  import { onMount, onDestroy } from 'svelte'

  // SVG layout constants - minimal but not zero to ensure spacing
  const BASE_LABEL_OFFSET = 5
  const TOP_MARGIN = 10
  const LEFT_MARGIN = 30
  const MAX_LABEL_LENGTH = 10 // Maximum number of characters before truncation
  const MIN_CELL_SIZE = 20 // Minimum cell size in pixels

  // Default color for inactive/filtered cells
  const DEFAULT_INACTIVE_COLOR = '#e0e0e0' // Light gray

  /**
   * Props for the AOI Transition Matrix Plot
   * @param AoiTransitionMatrix - 2D array where:
   *   - ROWS represent "FROM" AOI (displayed on Y-axis)
   *   - COLUMNS represent "TO" AOI (displayed on X-axis)
   * @param aoiLabels - Labels for the AOIs
   * @param height - Overall SVG height
   * @param width - Overall SVG width
   * @param cellSize - Size of each matrix cell
   * @param colorScale - Array with 2 colors for min and max values
   * @param xLabel - Label for X-axis (TO AOI)
   * @param yLabel - Label for Y-axis (FROM AOI)
   * @param legendTitle - Title for the color legend
   * @param belowMinColor - Color for values below minimum threshold
   * @param aboveMaxColor - Color for values above maximum threshold
   * @param showBelowMinLabels - Whether to show labels for values below minimum
   * @param showAboveMaxLabels - Whether to show labels for values above maximum
   * @param onClickLegend - Callback when legend is clicked
   * @param onValueClick - Callback when min/max values are clicked
   * @param onGradientClick - Callback when gradient bar is clicked
   */
  let {
    AoiTransitionMatrix = [],
    aoiLabels = [],
    height = 500,
    width = 500,
    cellSize = 30,
    colorScale = ['#f7fbff', '#08306b'],
    xLabel = 'To AOI',
    yLabel = 'From AOI',
    legendTitle = 'Transition Count',
    colorValueRange = [0, 0],
    onColorValueRangeChange = () => {},
    belowMinColor = DEFAULT_INACTIVE_COLOR,
    aboveMaxColor = DEFAULT_INACTIVE_COLOR,
    showBelowMinLabels = false,
    showAboveMaxLabels = false,
    onValueClick = () => {},
    onGradientClick = () => {},
  } = $props<{
    AoiTransitionMatrix: number[][]
    aoiLabels: string[]
    height?: number
    width?: number
    cellSize?: number
    colorScale?: string[]
    xLabel?: string
    yLabel?: string
    legendTitle?: string
    colorValueRange: [number, number]
    onColorValueRangeChange?: (value: [number, number]) => void
    belowMinColor?: string
    aboveMaxColor?: string
    showBelowMinLabels?: boolean
    showAboveMaxLabels?: boolean
    onValueClick?: (isMin: boolean) => void
    onGradientClick?: () => void
  }>()

  // Additional offsets for axis labels to prevent collisions
  const AXIS_LABEL_MARGIN = 20
  const INDIVIDUAL_LABEL_MARGIN = 10

  // Canvas and rendering state
  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasCtx = $state<CanvasRenderingContext2D | null>(null)
  let pixelRatio = $state(1)
  let renderScheduled = $state(false)
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 40 // Throttle to 40 fps

  // Dynamic offsets based on labels using the new utility
  const labelOffset = $derived.by(() => {
    return calculateLabelOffset(aoiLabels, 12, BASE_LABEL_OFFSET)
  })

  // Calculate max plotable area first (similar to RecurrencePlot's plotSize)
  const maxPlotArea = $derived.by(() => {
    // Calculate space needed for labels
    const yAxisSpace = LEFT_MARGIN + labelOffset + AXIS_LABEL_MARGIN
    const xAxisSpace = TOP_MARGIN + labelOffset + AXIS_LABEL_MARGIN

    // Space needed for legend (title + gradient + values)
    const legendSpace = 50

    // Calculate maximum available space respecting the absolute max height
    const availableWidth = width - yAxisSpace
    const availableHeight = height - xAxisSpace - legendSpace

    return { availableWidth, availableHeight }
  })

  // Calculate optimal cell size based on available space and number of AOIs
  const optimalCellSize = $derived.by(() => {
    if (aoiLabels.length === 0) return MIN_CELL_SIZE

    // Calculate the ideal cell size to fit all cells in the available area
    // We'll use the maximum possible size that fits within both width and height
    const cellSizeByWidth = maxPlotArea.availableWidth / aoiLabels.length
    const cellSizeByHeight = maxPlotArea.availableHeight / aoiLabels.length

    // Use the smaller of the two to ensure everything fits within bounds
    // This ensures we respect the maximum width and height
    const idealCellSize = Math.min(cellSizeByWidth, cellSizeByHeight)

    // Clamp to a reasonable minimum size
    return Math.max(MIN_CELL_SIZE, idealCellSize)
  })

  // Calculate actual grid size based on optimal cell size
  const actualGridWidth = $derived.by(() => optimalCellSize * aoiLabels.length)
  const actualGridHeight = $derived.by(() => optimalCellSize * aoiLabels.length)

  // Center the grid within available space
  const xOffset = $derived.by(() => {
    return (
      LEFT_MARGIN +
      labelOffset +
      (maxPlotArea.availableWidth - actualGridWidth) / 2
    )
  })

  const yOffset = $derived.by(() => {
    return (
      TOP_MARGIN +
      labelOffset +
      (maxPlotArea.availableHeight - actualGridHeight) / 2
    )
  })

  // Calculate the auto max value from the matrix
  const calculatedMaxValue = $derived.by(() => {
    const flatMatrix = AoiTransitionMatrix.flat()
    return flatMatrix.length > 0 ? Math.ceil(Math.max(...flatMatrix)) : 0
  })

  // Use either auto or custom max value based on configuration
  const effectiveMaxValue = $derived(
    colorValueRange[1] == 0 ? calculatedMaxValue : colorValueRange[1]
  )

  // Track cell positions for interaction
  const cellPositions = $derived.by(() => {
    const positions = []
    for (let row = 0; row < aoiLabels.length; row++) {
      for (let col = 0; col < aoiLabels.length; col++) {
        positions.push({
          row,
          col,
          x: xOffset + col * optimalCellSize,
          y: yOffset + row * optimalCellSize,
          width: optimalCellSize,
          height: optimalCellSize,
          value: AoiTransitionMatrix[row]?.[col] ?? 0,
        })
      }
    }
    return positions
  })

  // Setup canvas and context
  function setupCanvas() {
    if (!canvas) return

    // Get the device pixel ratio
    pixelRatio = window.devicePixelRatio || 1

    // Get the canvas context
    canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) return

    // Apply initial sizing
    resizeCanvas()

    // Render the initial state
    renderCanvas()
  }

  // Resize canvas to match container size and device pixel ratio
  function resizeCanvas() {
    if (!canvas || !canvasCtx) return

    // Set actual canvas dimensions (scaled for high DPI)
    // Width and height are now treated as absolute maximums
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio

    // Set display size (css pixels)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  // Clear the canvas
  function clearCanvas() {
    if (!canvasCtx || !canvas) return
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Render everything to canvas
  function renderCanvas() {
    if (!canvasCtx || !canvas) return
    clearCanvas()

    // Check if there's actually content to draw
    if (aoiLabels.length === 0) {
      // Draw "No data" message
      canvasCtx.save()
      canvasCtx.scale(pixelRatio, pixelRatio)
      canvasCtx.font = '12px sans-serif'
      canvasCtx.fillStyle = '#666'
      canvasCtx.textAlign = 'center'
      canvasCtx.textBaseline = 'middle'
      canvasCtx.fillText('No AOI data available', width / 2, height / 2)
      canvasCtx.restore()
      return
    }

    // Scale all drawing operations by the device pixel ratio
    canvasCtx.save()
    canvasCtx.scale(pixelRatio, pixelRatio)

    // Draw axis labels
    drawAxisLabels()

    // Draw grid and cell labels
    drawGrid()

    // Draw the matrix cells
    drawCells()

    // Draw the legend
    drawLegend()

    // Reset transformations
    canvasCtx.restore()
  }

  // Draw the X and Y axis labels
  function drawAxisLabels() {
    if (!canvasCtx) return

    // Make sure there's enough space for labels
    if (actualGridWidth < 50 || actualGridHeight < 50) return

    // Setup text styling
    canvasCtx.font = '12px sans-serif'
    canvasCtx.fillStyle = '#000'
    canvasCtx.textBaseline = 'middle'

    // Draw X-axis label (To AOI)
    canvasCtx.textAlign = 'center'
    canvasCtx.fillText(
      xLabel,
      xOffset + actualGridWidth / 2,
      yOffset - labelOffset
    )

    // Draw Y-axis label (From AOI)
    canvasCtx.save()
    canvasCtx.translate(xOffset - labelOffset, yOffset + actualGridHeight / 2)
    canvasCtx.rotate(-Math.PI / 2)
    canvasCtx.fillText(yLabel, 0, 0)
    canvasCtx.restore()
  }

  // Draw grid and labels
  function drawGrid() {
    if (!canvasCtx) return

    // Setup text styling for AOI labels
    canvasCtx.font = '12px sans-serif'
    canvasCtx.fillStyle = '#000'
    canvasCtx.textBaseline = 'middle'

    // Adjust font size based on available space
    const labelFontSize = Math.min(12, Math.max(8, optimalCellSize / 3))
    canvasCtx.font = `${labelFontSize}px sans-serif`

    // Draw column labels (top) - moved 5px higher
    canvasCtx.textAlign = 'left'
    for (let col = 0; col < aoiLabels.length; col++) {
      const x = xOffset + col * optimalCellSize + optimalCellSize / 2
      const y = yOffset - INDIVIDUAL_LABEL_MARGIN // Added 5px offset to move higher

      // Determine if space is tight
      const isSpaceTight = aoiLabels.length > 6 || optimalCellSize < 30

      // Rotate labels if they're too long or there are too many
      if (isSpaceTight) {
        canvasCtx.save()
        canvasCtx.translate(x, y)
        canvasCtx.rotate(-Math.PI / 4)
        canvasCtx.fillText(
          aoiLabels[col].length > MAX_LABEL_LENGTH
            ? aoiLabels[col].substring(0, MAX_LABEL_LENGTH) + '...'
            : aoiLabels[col],
          0,
          0
        )
        canvasCtx.restore()
      } else {
        canvasCtx.fillText(
          aoiLabels[col].length > MAX_LABEL_LENGTH
            ? aoiLabels[col].substring(0, MAX_LABEL_LENGTH) + '...'
            : aoiLabels[col],
          x,
          y
        )
      }
    }

    // Draw row labels (left side)
    canvasCtx.textAlign = 'end'
    for (let row = 0; row < aoiLabels.length; row++) {
      const x = xOffset - INDIVIDUAL_LABEL_MARGIN
      const y = yOffset + row * optimalCellSize + optimalCellSize / 2

      // Truncate text if needed
      const labelText =
        aoiLabels[row].length > MAX_LABEL_LENGTH
          ? aoiLabels[row].substring(0, MAX_LABEL_LENGTH) + '...'
          : aoiLabels[row]

      canvasCtx.fillText(labelText, x, y)
    }

    // Draw grid lines
    canvasCtx.strokeStyle = '#ddd'
    canvasCtx.lineWidth = 0.5

    // Vertical grid lines
    for (let col = 0; col <= aoiLabels.length; col++) {
      const x = xOffset + col * optimalCellSize
      canvasCtx.beginPath()
      canvasCtx.moveTo(x, yOffset)
      canvasCtx.lineTo(x, yOffset + actualGridHeight)
      canvasCtx.stroke()
    }

    // Horizontal grid lines
    for (let row = 0; row <= aoiLabels.length; row++) {
      const y = yOffset + row * optimalCellSize
      canvasCtx.beginPath()
      canvasCtx.moveTo(xOffset, y)
      canvasCtx.lineTo(xOffset + actualGridWidth, y)
      canvasCtx.stroke()
    }
  }

  // Draw matrix cells
  function drawCells() {
    if (!canvasCtx) return

    // Adjust text size based on cell size
    const valueFontSize = Math.min(12, Math.max(8, optimalCellSize / 3))

    // Draw each cell based on its value
    for (let row = 0; row < aoiLabels.length; row++) {
      for (let col = 0; col < aoiLabels.length; col++) {
        const value = AoiTransitionMatrix[row]?.[col] ?? 0

        // Calculate cell position
        const x = xOffset + col * optimalCellSize
        const y = yOffset + row * optimalCellSize

        // Determine cell color based on value
        let cellColor
        let textColor

        if (isBelowMinimum(value)) {
          cellColor = belowMinColor
          textColor = '#000'
        } else if (isAboveMaximum(value)) {
          cellColor = aboveMaxColor
          textColor = '#fff'
        } else {
          cellColor = getColor(value)
          textColor = getContrastTextColor(cellColor)
        }

        // Draw cell background
        canvasCtx.fillStyle = cellColor
        canvasCtx.fillRect(x, y, optimalCellSize, optimalCellSize)

        // Draw cell value if there's enough space
        // Now always show values, including zero values
        if (optimalCellSize >= 15) {
          canvasCtx.font = `${valueFontSize}px sans-serif`
          canvasCtx.fillStyle = textColor
          canvasCtx.textAlign = 'center'
          canvasCtx.textBaseline = 'middle'
          canvasCtx.fillText(
            value.toString(),
            x + optimalCellSize / 2,
            y + optimalCellSize / 2
          )
        }
      }
    }
  }

  // Tracking for legend hover effect
  let hoverState = $state<'none' | 'gradient' | 'minValue' | 'maxValue'>('none')

  // Zone definitions for interaction
  let minValueZone = $state<{ x: number; y: number; radius: number } | null>(
    null
  )
  let maxValueZone = $state<{ x: number; y: number; radius: number } | null>(
    null
  )
  let gradientZone = $state<{
    x: number
    y: number
    width: number
    height: number
    radius: number
  } | null>(null)

  // Legend data for general interaction
  let legendData = $state<{
    x: number
    y: number
    width: number
    height: number
    minValue: number
    maxValue: number
  } | null>(null)

  // Check if a value is below the minimum threshold
  function isBelowMinimum(value: number): boolean {
    return value < colorValueRange[0]
  }

  // Check if a value is above the maximum threshold
  function isAboveMaximum(value: number): boolean {
    return value > effectiveMaxValue && colorValueRange[1] !== 0
  }

  // Calculate color based on value
  function getColor(value: number): string {
    return getColorForValue(
      value,
      colorValueRange[0],
      effectiveMaxValue,
      colorScale
    )
  }

  // Fallback function to draw a minimalist legend when space is tight
  function drawMinimalistLegend(yPosition: number) {
    // Use width proportional to the matrix
    const legendWidth = Math.min(200, actualGridWidth * 0.7)

    // Center legend horizontally with the matrix
    const legendX = xOffset + (actualGridWidth - legendWidth) / 2

    // Minimal gradient height
    const gradientHeight = 8 // Reduced from 10px to 8px

    // Create gradient
    const gradient = canvasCtx!.createLinearGradient(
      legendX,
      0,
      legendX + legendWidth,
      0
    )

    if (colorScale.length === 3) {
      gradient.addColorStop(0, colorScale[0])
      gradient.addColorStop(0.5, colorScale[1])
      gradient.addColorStop(1, colorScale[2])
    } else {
      gradient.addColorStop(0, colorScale[0])
      gradient.addColorStop(1, colorScale[1])
    }

    // Draw gradient rectangle
    canvasCtx!.fillStyle = gradient
    canvasCtx!.fillRect(legendX, yPosition, legendWidth, gradientHeight)

    // Draw border around gradient
    canvasCtx!.strokeStyle = '#666'
    canvasCtx!.lineWidth = 0.5
    canvasCtx!.strokeRect(legendX, yPosition, legendWidth, gradientHeight)

    // Store legend data for interaction
    legendData = {
      x: legendX,
      y: yPosition,
      width: legendWidth,
      height: gradientHeight,
      minValue: colorValueRange[0],
      maxValue: effectiveMaxValue,
    }
  }

  // Draw the color legend
  function drawLegend() {
    if (!canvasCtx) return

    // Calculate available space for legend
    const matrixBottom = yOffset + actualGridHeight
    const availableLegendSpace = height - matrixBottom - 10 // Reserve 10px padding at bottom

    // If almost no space is available, draw a minimalist legend
    if (availableLegendSpace < 30) {
      // Very compact legend, just the gradient with tiny text
      drawMinimalistLegend(matrixBottom + 5)
      return
    }

    // Calculate legend position with available space
    const legendTop = matrixBottom + Math.min(25, availableLegendSpace * 0.25) // Reduced spacing

    // Use width proportional to the matrix
    const legendWidth = Math.min(300, actualGridWidth * 0.8)

    // Center legend horizontally with the matrix
    const legendX = xOffset + (actualGridWidth - legendWidth) / 2

    // Legend components vertical positioning
    const titleY = legendTop
    const gradientY = titleY + Math.min(20, availableLegendSpace * 0.25) // Reduced spacing
    const gradientHeight = Math.min(12, availableLegendSpace * 0.2) // Thinner gradient bar
    const valuesY = gradientY + gradientHeight + 4 // Reduced spacing

    // The circle radius for value zones
    const valueRadius = Math.max(15, gradientHeight * 1.5)

    // Define interaction zones
    minValueZone = {
      x: legendX,
      y: valuesY + 6, // Center of the text
      radius: valueRadius,
    }

    maxValueZone = {
      x: legendX + legendWidth,
      y: valuesY + 6, // Center of the text
      radius: valueRadius,
    }

    gradientZone = {
      x: legendX - 10, // Increased buffer from 5 to 15
      y: gradientY - 10, // Increased buffer from 5 to 15
      width: legendWidth + 20, // Increased buffer from 10 to 30
      height: gradientHeight + 20, // Increased buffer from 10 to 30
      radius: 15, // Border radius for rounded corners
    }

    // Draw hover effects based on the current hover state
    if (hoverState !== 'none') {
      const alpha = 0.2 // Fixed opacity without animation

      if (hoverState === 'minValue' && minValueZone) {
        // Draw circle highlight for min value
        canvasCtx.fillStyle = `rgba(200, 200, 200, ${alpha})`
        canvasCtx.beginPath()
        canvasCtx.arc(
          minValueZone.x,
          minValueZone.y,
          minValueZone.radius,
          0,
          Math.PI * 2
        )
        canvasCtx.fill()
      } else if (hoverState === 'maxValue' && maxValueZone) {
        // Draw circle highlight for max value
        canvasCtx.fillStyle = `rgba(200, 200, 200, ${alpha})`
        canvasCtx.beginPath()
        canvasCtx.arc(
          maxValueZone.x,
          maxValueZone.y,
          maxValueZone.radius,
          0,
          Math.PI * 2
        )
        canvasCtx.fill()
      } else if (hoverState === 'gradient' && gradientZone) {
        // Draw rounded rectangle highlight for gradient
        canvasCtx.fillStyle = `rgba(200, 200, 200, ${alpha})`
        drawRoundedRect(
          canvasCtx,
          gradientZone.x,
          gradientZone.y,
          gradientZone.width,
          gradientZone.height,
          gradientZone.radius
        )
      }
    }

    // Draw legend title if there's room
    if (availableLegendSpace > 40) {
      canvasCtx.font = '12px sans-serif'
      canvasCtx.fillStyle = '#000'
      canvasCtx.textAlign = 'center'
      canvasCtx.textBaseline = 'top'
      canvasCtx.fillText(legendTitle, xOffset + actualGridWidth / 2, titleY)
    }

    // Create gradient
    const gradient = canvasCtx.createLinearGradient(
      legendX,
      0,
      legendX + legendWidth,
      0
    )

    if (colorScale.length === 3) {
      gradient.addColorStop(0, colorScale[0])
      gradient.addColorStop(0.5, colorScale[1])
      gradient.addColorStop(1, colorScale[2])
    } else {
      gradient.addColorStop(0, colorScale[0])
      gradient.addColorStop(1, colorScale[1])
    }

    // Draw gradient rectangle
    canvasCtx.fillStyle = gradient
    canvasCtx.fillRect(legendX, gradientY, legendWidth, gradientHeight)

    // Draw border around gradient
    canvasCtx.strokeStyle = '#666'
    canvasCtx.lineWidth = 0.5
    canvasCtx.strokeRect(legendX, gradientY, legendWidth, gradientHeight)

    // Draw min and max values if there's room
    if (availableLegendSpace > 35) {
      canvasCtx.font = '12px sans-serif'
      canvasCtx.fillStyle = '#000'
      canvasCtx.textAlign = 'center'
      canvasCtx.textBaseline = 'top'

      // Min value
      canvasCtx.fillText(colorValueRange[0].toString(), legendX, valuesY)

      // Max value
      canvasCtx.fillText(
        effectiveMaxValue.toString(),
        legendX + legendWidth,
        valuesY
      )
    }

    // Store legend data for interaction with expanded area
    legendData = {
      x: legendX - 10,
      y: titleY - 5,
      width: legendWidth + 20,
      height: valuesY + 15 - (titleY - 5),
      minValue: colorValueRange[0],
      maxValue: effectiveMaxValue,
    }
  }

  // Function to draw rounded rectangle
  function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
    ctx.fill()
  }

  // Handle mouse movement over the canvas
  function handleMouseMove(event: MouseEvent) {
    const currentTime = performance.now()
    if (currentTime - lastMouseMoveTime < FRAME_TIME) {
      return
    }
    lastMouseMoveTime = currentTime

    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    // Get mouse position relative to the canvas
    const mouseX = (event.clientX - rect.left) / pixelRatio
    const mouseY = (event.clientY - rect.top) / pixelRatio

    // Check if mouse is over a cell
    const hoveredCell = cellPositions.find(
      cell =>
        mouseX >= cell.x &&
        mouseX <= cell.x + cell.width &&
        mouseY >= cell.y &&
        mouseY <= cell.y + cell.height
    )

    if (hoveredCell) {
      const row = hoveredCell.row
      const col = hoveredCell.col
      const value = hoveredCell.value

      // Show tooltip with cell information
      const idealX = rect.left + hoveredCell.x + hoveredCell.width + 10
      const idealY =
        rect.top + hoveredCell.y + hoveredCell.height / 2 + window.scrollY

      updateTooltip({
        x: idealX,
        y: idealY,
        content: [
          { key: 'From', value: aoiLabels[row] },
          { key: 'To', value: aoiLabels[col] },
          { key: 'Value', value: value.toString() },
        ],
        visible: true,
        width: 150,
      })
      return
    }

    // Store previous hover state to detect changes
    const prevHoverState = hoverState

    // Check if mouse is over min value
    if (
      minValueZone &&
      Math.hypot(mouseX - minValueZone.x, mouseY - minValueZone.y) <=
        minValueZone.radius
    ) {
      hoverState = 'minValue'
      canvas.style.cursor = 'pointer'
    }
    // Check if mouse is over max value
    else if (
      maxValueZone &&
      Math.hypot(mouseX - maxValueZone.x, mouseY - maxValueZone.y) <=
        maxValueZone.radius
    ) {
      hoverState = 'maxValue'
      canvas.style.cursor = 'pointer'
    }
    // Check if mouse is over gradient
    else if (
      gradientZone &&
      mouseX >= gradientZone.x &&
      mouseX <= gradientZone.x + gradientZone.width &&
      mouseY >= gradientZone.y &&
      mouseY <= gradientZone.y + gradientZone.height
    ) {
      hoverState = 'gradient'
      canvas.style.cursor = 'pointer'
    }
    // Not hovering over any interactive element
    else {
      hoverState = 'none'
      canvas.style.cursor = 'default'
    }

    // Redraw if hover state changed
    if (hoverState !== prevHoverState) {
      scheduleRender()
    }

    // Reset tooltip if not over a cell
    if (hoverState === 'none') {
      updateTooltip(null)
    }
  }

  // Handle mouse leaving the canvas
  function handleMouseLeave() {
    updateTooltip(null)

    // Reset hover state
    if (hoverState !== 'none') {
      hoverState = 'none'
      scheduleRender()
    }

    if (canvas) {
      canvas.style.cursor = 'default'
    }
  }

  // Handle mouse clicks - now with different callbacks for different zones
  function handleMouseDown(event: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    // Get mouse position relative to the canvas
    const mouseX = (event.clientX - rect.left) / pixelRatio
    const mouseY = (event.clientY - rect.top) / pixelRatio

    // Check which zone was clicked
    if (
      minValueZone &&
      Math.hypot(mouseX - minValueZone.x, mouseY - minValueZone.y) <=
        minValueZone.radius
    ) {
      // Min value clicked
      onValueClick(true)
    } else if (
      maxValueZone &&
      Math.hypot(mouseX - maxValueZone.x, mouseY - maxValueZone.y) <=
        maxValueZone.radius
    ) {
      // Max value clicked
      onValueClick(false)
    } else if (
      gradientZone &&
      mouseX >= gradientZone.x &&
      mouseX <= gradientZone.x + gradientZone.width &&
      mouseY >= gradientZone.y &&
      mouseY <= gradientZone.y + gradientZone.height
    ) {
      // Gradient clicked
      onGradientClick()
    } else if (
      legendData &&
      mouseX >= legendData.x &&
      mouseX <= legendData.x + legendData.width &&
      mouseY >= legendData.y &&
      mouseY <= legendData.y + legendData.height
    ) {
      // Legend clicked
      void 0
    }
  }

  // Create a render scheduler
  function scheduleRender() {
    if (!renderScheduled) {
      renderScheduled = true
      requestAnimationFrame(() => {
        if (canvas && canvasCtx) {
          resizeCanvas()
          renderCanvas()
        }
        renderScheduled = false
      })
    }
  }

  // Watch for changes in props and re-render
  $effect(() => {
    if (canvas && canvasCtx) {
      scheduleRender()
    }
  })

  // Lifecycle hooks
  onMount(() => {
    setupCanvas()

    // Effect to update when color value range changes
    $effect(() => {
      onColorValueRangeChange = onColorValueRangeChange
    })
  })

  onDestroy(() => {
    // Clean up event listeners if needed
  })
</script>

<div class="canvas-container">
  <canvas
    bind:this={canvas}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    onmousedown={handleMouseDown}
  ></canvas>
</div>

<style>
  .canvas-container {
    position: relative;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: visible; /* Important to prevent cropping */
  }

  canvas {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }
</style>
