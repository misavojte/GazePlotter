<script lang="ts">
  import { getColorForValue, getContrastTextColor } from '$lib/utils/colorUtils'
  import { updateTooltip } from '$lib/stores/tooltipStore'
  import {
    calculateLabelOffset,
    truncateTextToPixelWidth,
  } from '$lib/utils/textUtils'
  import { onMount, untrack } from 'svelte'
  import { browser } from '$app/environment'
  import {
    createCanvasState,
    setupCanvas,
    resizeCanvas,
    getScaledMousePosition,
    getTooltipPosition,
    setupDpiChangeListeners,
    beginCanvasDrawing,
    finishCanvasDrawing,
    type CanvasState,
  } from '$lib/utils/canvasUtils'

  // SVG layout constants - minimal but not zero to ensure spacing
  const BASE_LABEL_OFFSET = 5
  const TOP_MARGIN = 30 // Increased to ensure "To AOI" label is visible
  const LEFT_MARGIN = 30 // Increased to ensure "From AOI" label is visible
  const MIN_CELL_SIZE = 20 // Minimum cell size in pixels
  const MAX_LABEL_LENGTH = 85 // Maximum width of the label in pixels

  // Default color for inactive/filtered cells
  const DEFAULT_INACTIVE_COLOR = '#e0e0e0' // Light gray

  /**
   * Props for the Transition Matrix Plot
   * @param TransitionMatrix - 2D array where:
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
   * @param dpiOverride - Optional DPI override for exports
   * @param marginTop - Additional top margin (default 0)
   * @param marginRight - Additional right margin (default 0)
   * @param marginBottom - Additional bottom margin (default 0)
   * @param marginLeft - Additional left margin (default 0)
   */
  let {
    TransitionMatrix = [],
    aoiLabels = [],
    height = 500,
    width = 500,
    colorScale = ['#f7fbff', '#08306b'],
    xLabel = 'To AOI',
    yLabel = 'From AOI',
    legendTitle = 'Transition Count',
    colorValueRange = [0, 0],
    belowMinColor = DEFAULT_INACTIVE_COLOR,
    aboveMaxColor = DEFAULT_INACTIVE_COLOR,
    showBelowMinLabels = false,
    showAboveMaxLabels = false,
    onValueClick = () => {},
    onGradientClick = () => {},
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  } = $props<{
    TransitionMatrix: number[][]
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
    dpiOverride?: number | null
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
  }>()

  // Additional offsets for axis labels to prevent collisions
  const AXIS_LABEL_MARGIN = 20
  const INDIVIDUAL_LABEL_MARGIN = 10

  // Canvas and rendering state using our utility
  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  // Create a render scheduler function
  function scheduleRender() {
    if (!canvasState.renderScheduled && browser) {
      canvasState.renderScheduled = true
      requestAnimationFrame(() => {
        renderCanvas()
        canvasState.renderScheduled = false
      })
    }
  }

  // Dynamic offsets based on labels using the new utility
  const labelOffset = $derived.by(() => {
    // Use a fixed offset based on MAX_LABEL_LENGTH instead of calculating from actual labels
    // NO, calculate from actual labels using the text utils
    const calculatedOffset = calculateLabelOffset(
      aoiLabels,
      12,
      BASE_LABEL_OFFSET
    )
    return Math.min(calculatedOffset, MAX_LABEL_LENGTH)
  })

  // Calculate max plotable area first (similar to RecurrencePlot's plotSize)
  const maxPlotArea = $derived.by(() => {
    // Calculate space needed for labels
    const yAxisSpace =
      LEFT_MARGIN + labelOffset + AXIS_LABEL_MARGIN + marginLeft
    const xAxisSpace = TOP_MARGIN + labelOffset + AXIS_LABEL_MARGIN + marginTop

    // Space needed for legend (title + gradient + values)
    const legendSpace = 50 + marginBottom

    // Calculate maximum available space respecting the absolute max height
    const availableWidth = width - yAxisSpace - marginRight
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
      ((maxPlotArea.availableWidth - actualGridWidth) >> 1) +
      marginLeft
    )
  })

  const yOffset = $derived.by(() => {
    return (
      TOP_MARGIN +
      labelOffset +
      ((maxPlotArea.availableHeight - actualGridHeight) >> 1) +
      marginTop
    )
  })

  // Calculate the auto max value from the matrix
  const calculatedMaxValue = $derived.by(() => {
    const flatMatrix = TransitionMatrix.flat()
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
          value: TransitionMatrix[row]?.[col] ?? 0,
        })
      }
    }
    return positions
  })

  // Setup canvas and context using our utilities
  function initCanvas() {
    if (!canvas) return

    // Initialize canvas with our utility
    canvasState = setupCanvas(canvasState, canvas, dpiOverride)

    // Resize and render initially
    canvasState = resizeCanvas(
      canvasState,
      width + marginLeft + marginRight,
      height + marginTop + marginBottom
    )
    renderCanvas()
  }

  // Render everything to canvas
  function renderCanvas() {
    beginCanvasDrawing(canvasState, true)

    // Get context from state
    const ctx = canvasState.context
    if (!ctx) return

    // Check if there's actually content to draw
    if (aoiLabels.length === 0) {
      // Draw "No data" message
      ctx.font = '12px sans-serif'
      ctx.fillStyle = '#666'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No AOI data available', width >> 1, height >> 1)
      finishCanvasDrawing(canvasState)
      return
    }

    // Draw axis labels
    drawAxisLabels(ctx)

    // Draw grid and cell labels
    drawGrid(ctx)

    // Draw the matrix cells
    drawCells(ctx)

    // Draw the legend
    drawLegend(ctx)

    // Finish drawing
    finishCanvasDrawing(canvasState)
  }

  // Draw the X and Y axis labels
  function drawAxisLabels(ctx: CanvasRenderingContext2D) {
    // Make sure there's enough space for labels
    if (actualGridWidth < 50 || actualGridHeight < 50) return

    // Setup text styling
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#000'
    ctx.textBaseline = 'middle'

    // Draw X-axis label (To AOI)
    ctx.textAlign = 'center'
    ctx.fillText(
      xLabel,
      xOffset + (actualGridWidth >> 1),
      yOffset - labelOffset - AXIS_LABEL_MARGIN
    )

    // Draw Y-axis label (From AOI)
    ctx.save()
    ctx.translate(
      xOffset - labelOffset - AXIS_LABEL_MARGIN,
      yOffset + (actualGridHeight >> 1)
    )
    ctx.rotate(-Math.PI / 2) // Rotate 90 degrees counterclockwise. No bitwise operator here.
    ctx.fillText(yLabel, 0, 0)
    ctx.restore()
  }

  // Draw grid and labels
  function drawGrid(ctx: CanvasRenderingContext2D) {
    // Setup text styling for AOI labels
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#000'
    ctx.textBaseline = 'middle'

    // Adjust font size based on available space
    const labelFontSize = Math.min(12, Math.max(8, optimalCellSize / 3))
    ctx.font = `${labelFontSize}px sans-serif`

    // Draw column labels (top) - moved 5px higher
    ctx.textAlign = 'left'
    for (let col = 0; col < aoiLabels.length; col++) {
      const x = xOffset + col * optimalCellSize + (optimalCellSize >> 1)
      const y = yOffset - INDIVIDUAL_LABEL_MARGIN // Added 5px offset to move higher

      // Rotate labels if they're too long or there are too many
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-Math.PI / 4)
      ctx.fillText(
        truncateTextToPixelWidth(
          aoiLabels[col],
          MAX_LABEL_LENGTH * 1.5, // 1.5x the max label length to account for rotation
          12,
          'sans-serif',
          '...'
        ),
        0,
        0
      )
      ctx.restore()
    }

    // Draw row labels (left side)
    ctx.textAlign = 'end'
    for (let row = 0; row < aoiLabels.length; row++) {
      const x = xOffset - INDIVIDUAL_LABEL_MARGIN
      const y = yOffset + row * optimalCellSize + (optimalCellSize >> 1)

      // Truncate text if needed
      const labelText = truncateTextToPixelWidth(
        aoiLabels[row],
        MAX_LABEL_LENGTH,
        12,
        'sans-serif',
        '...'
      )

      ctx.fillText(labelText, x, y)
    }

    // Draw grid lines
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 0.5

    // Vertical grid lines
    for (let col = 0; col <= aoiLabels.length; col++) {
      const x = xOffset + col * optimalCellSize
      ctx.beginPath()
      ctx.moveTo(x, yOffset)
      ctx.lineTo(x, yOffset + actualGridHeight)
      ctx.stroke()
    }

    // Horizontal grid lines
    for (let row = 0; row <= aoiLabels.length; row++) {
      const y = yOffset + row * optimalCellSize
      ctx.beginPath()
      ctx.moveTo(xOffset, y)
      ctx.lineTo(xOffset + actualGridWidth, y)
      ctx.stroke()
    }
  }

  // Draw matrix cells
  function drawCells(ctx: CanvasRenderingContext2D) {
    // Adjust text size based on cell size
    const valueFontSize = Math.min(12, Math.max(8, optimalCellSize / 3))

    // Draw each cell based on its value
    for (let row = 0; row < aoiLabels.length; row++) {
      for (let col = 0; col < aoiLabels.length; col++) {
        const value = TransitionMatrix[row]?.[col] ?? 0

        // Calculate cell position
        const x = xOffset + col * optimalCellSize
        const y = yOffset + row * optimalCellSize

        // Determine cell color based on value
        let cellColor
        let textColor

        if (isBelowMinimum(value)) {
          cellColor = belowMinColor
          textColor = getContrastTextColor(belowMinColor)
        } else if (isAboveMaximum(value)) {
          cellColor = aboveMaxColor
          textColor = getContrastTextColor(aboveMaxColor)
        } else {
          cellColor = getColor(value)
          textColor = getContrastTextColor(cellColor)
        }

        // Draw cell background
        ctx.fillStyle = cellColor
        ctx.fillRect(x, y, optimalCellSize, optimalCellSize)

        // Draw cell value if there's enough space and labels are enabled
        if (optimalCellSize >= 15) {
          // Check if we should show the value based on settings
          const shouldShowValue =
            (!isBelowMinimum(value) && !isAboveMaximum(value)) || // Always show values within range
            (isBelowMinimum(value) && showBelowMinLabels) || // Show below min if enabled
            (isAboveMaximum(value) && showAboveMaxLabels) // Show above max if enabled

          if (shouldShowValue) {
            ctx.font = `${valueFontSize}px sans-serif`
            ctx.fillStyle = textColor
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(
              value.toString(),
              x + (optimalCellSize >> 1),
              y + (optimalCellSize >> 1)
            )
          }
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
  function drawMinimalistLegend(
    ctx: CanvasRenderingContext2D,
    yPosition: number
  ) {
    // Use width proportional to the matrix
    const legendWidth = Math.min(200, actualGridWidth * 0.7)

    // Center legend horizontally with the matrix
    const legendX = xOffset + ((actualGridWidth - legendWidth) >> 1)

    // Minimal gradient height
    const gradientHeight = 8 // Reduced from 10px to 8px

    // Create gradient
    const gradient = ctx.createLinearGradient(
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
    ctx.fillStyle = gradient
    ctx.fillRect(legendX, yPosition, legendWidth, gradientHeight)

    // Draw border around gradient
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 0.5
    ctx.strokeRect(legendX, yPosition, legendWidth, gradientHeight)

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
  function drawLegend(ctx: CanvasRenderingContext2D) {
    // Calculate available space for legend
    const matrixBottom = yOffset + actualGridHeight
    const availableLegendSpace = height - matrixBottom - 10 // Reserve 10px padding at bottom

    // If almost no space is available, draw a minimalist legend
    if (availableLegendSpace < 30) {
      // Very compact legend, just the gradient with tiny text
      drawMinimalistLegend(ctx, matrixBottom + 5)
      return
    }

    // Calculate legend position with available space
    const legendTop = matrixBottom + Math.min(25, availableLegendSpace * 0.25) // Reduced spacing

    // Use width proportional to the matrix
    const legendWidth = Math.min(300, actualGridWidth * 0.8)

    // Center legend horizontally with the matrix
    const legendX = xOffset + ((actualGridWidth - legendWidth) >> 1)

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
        ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`
        ctx.beginPath()
        ctx.arc(
          minValueZone.x,
          minValueZone.y,
          minValueZone.radius,
          0,
          Math.PI << 1
        )
        ctx.fill()
      } else if (hoverState === 'maxValue' && maxValueZone) {
        // Draw circle highlight for max value
        ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`
        ctx.beginPath()
        ctx.arc(
          maxValueZone.x,
          maxValueZone.y,
          maxValueZone.radius,
          0,
          Math.PI << 1
        )
        ctx.fill()
      } else if (hoverState === 'gradient' && gradientZone) {
        // Draw rounded rectangle highlight for gradient
        ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`
        drawRoundedRect(
          ctx,
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
      ctx.font = '12px sans-serif'
      ctx.fillStyle = '#000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(legendTitle, xOffset + (actualGridWidth >> 1), titleY)
    }

    // Create gradient
    const gradient = ctx.createLinearGradient(
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
    ctx.fillStyle = gradient
    ctx.fillRect(legendX, gradientY, legendWidth, gradientHeight)

    // Draw border around gradient
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 0.5
    ctx.strokeRect(legendX, gradientY, legendWidth, gradientHeight)

    // Draw min and max values if there's room
    if (availableLegendSpace > 35) {
      ctx.font = '12px sans-serif'
      ctx.fillStyle = '#000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      // Min value
      ctx.fillText(colorValueRange[0].toString(), legendX, valuesY)

      // Max value
      ctx.fillText(effectiveMaxValue.toString(), legendX + legendWidth, valuesY)
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

  // Handle mouse movement over the canvas using our scaled position utility
  function handleMouseMove(event: MouseEvent) {
    // Remove throttling completely - process every event
    if (!canvas) return

    // Get properly scaled mouse position
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

    // Store previous state
    const oldHoverState = hoverState

    // Check for hovering over a cell first
    let isOverCell = false
    let hoveredCellInfo = null

    for (const cell of cellPositions) {
      if (
        mouseX >= cell.x &&
        mouseX <= cell.x + cell.width &&
        mouseY >= cell.y &&
        mouseY <= cell.y + cell.height
      ) {
        isOverCell = true
        hoveredCellInfo = {
          row: cell.row,
          col: cell.col,
          value: cell.value,
          x: cell.x,
          y: cell.y,
          width: cell.width,
          height: cell.height,
        }
        break
      }
    }

    // If over a cell, show tooltip and clear hover state
    if (isOverCell && hoveredCellInfo) {
      const tooltipPos = getTooltipPosition(
        canvasState,
        hoveredCellInfo.x + hoveredCellInfo.width,
        hoveredCellInfo.y + (hoveredCellInfo.height >> 1),
        { x: 10, y: 0 }
      )

      updateTooltip({
        x: tooltipPos.x,
        y: tooltipPos.y,
        content: [
          { key: 'From', value: aoiLabels[hoveredCellInfo.row] },
          { key: 'To', value: aoiLabels[hoveredCellInfo.col] },
          { key: 'Value', value: hoveredCellInfo.value.toString() },
        ],
        visible: true,
        width: 150,
      })

      // Force hover state to none when over cells
      hoverState = 'none'
    }
    // Not over a cell, check legend elements
    else {
      // Clear tooltip when not over a cell
      updateTooltip(null)

      // Reset hover state first
      hoverState = 'none'

      // Check min value circle
      if (
        minValueZone &&
        Math.hypot(mouseX - minValueZone.x, mouseY - minValueZone.y) <=
          minValueZone.radius
      ) {
        hoverState = 'minValue'
      }
      // Check max value circle
      else if (
        maxValueZone &&
        Math.hypot(mouseX - maxValueZone.x, mouseY - maxValueZone.y) <=
          maxValueZone.radius
      ) {
        hoverState = 'maxValue'
      }
      // Check gradient area
      else if (
        gradientZone &&
        mouseX >= gradientZone.x &&
        mouseX <= gradientZone.x + gradientZone.width &&
        mouseY >= gradientZone.y &&
        mouseY <= gradientZone.y + gradientZone.height
      ) {
        hoverState = 'gradient'
      }
    }

    // Update cursor style
    canvas.style.cursor = hoverState !== 'none' ? 'pointer' : 'default'

    // Always redraw on state change
    if (oldHoverState !== hoverState) {
      // Force immediate redraw without scheduling
      renderCanvas()
    }
  }

  // Make mouse leave handler more aggressive
  function handleMouseLeave() {
    updateTooltip(null)

    // Always reset hover state
    const oldHoverState = hoverState
    hoverState = 'none'

    if (canvas) {
      canvas.style.cursor = 'default'
    }

    // Force redraw if state changed
    if (oldHoverState !== 'none') {
      renderCanvas()
    }
  }

  // Handle mouse clicks - now with different callbacks for different zones
  function handleMouseDown(event: MouseEvent) {
    if (!canvas) return

    // Get properly scaled mouse position
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

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

  // Track data changes and schedule renders
  $effect(() => {
    // These direct references create dependencies on relevant data
    const _ = [
      TransitionMatrix,
      aoiLabels,
      width,
      height,
      colorScale,
      xLabel,
      yLabel,
      legendTitle,
      colorValueRange,
      belowMinColor,
      aboveMaxColor,
      showBelowMinLabels,
      showAboveMaxLabels,
      dpiOverride,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    ]

    untrack(() => {
      if (canvasState.canvas && canvasState.context) {
        // Reset canvas state with new DPI override if it changed
        if (canvasState.dpiOverride !== dpiOverride) {
          canvasState = setupCanvas(
            canvasState,
            canvasState.canvas,
            dpiOverride
          )
        }
        canvasState = resizeCanvas(
          canvasState,
          width + marginLeft + marginRight,
          height + marginTop + marginBottom
        )
        scheduleRender()
      }
    })
  })

  // Lifecycle hooks
  onMount(() => {
    if (canvas) {
      initCanvas()

      // Setup DPI and position change listeners with proper state management
      const cleanup = setupDpiChangeListeners(
        // State getter function that always returns the current state
        () => canvasState,
        // State setter function to properly update the state
        newState => {
          canvasState = newState
          // Resize with new pixel ratio if it changed
          if (canvasState.canvas) {
            canvasState = resizeCanvas(
              canvasState,
              width + marginLeft + marginRight,
              height + marginTop + marginBottom
            )
            renderCanvas() // Ensure canvas redraws after state update
          }
        },
        dpiOverride,
        renderCanvas
      )

      // Clean up event listeners and interval on destroy
      return () => {
        cleanup()
      }
    }
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
