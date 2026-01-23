<script lang="ts">
  import {
    getColorForValue,
    getContrastTextColor,
  } from '$lib/shared/utils/colorUtils'
  import { updateTooltip } from '$lib/tooltip'
  import {
    calculateLabelOffset,
    truncateTextToPixelWidth,
    SYSTEM_SANS_SERIF_STACK,
  } from '$lib/shared/utils/textUtils'
  import { getContext, onDestroy, onMount, untrack } from 'svelte'
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
    alignToPixelCenter,
    strokeCrispRect,
  } from '$lib/shared/utils/canvasUtils'
  import type { CanvasState } from '$lib/shared/utils/canvasUtils'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
  } from '$lib/shared/utils/exportUtils'

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
    TransitionMatrix = new Float64Array(0),
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
    TransitionMatrix: Float64Array | number[]
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

  // Canvas and rendering state using our utility
  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(
    EXPORT_SOURCE_CONTEXT
  )

  $effect(() => {
    if (!exportRegistrar) return
    if (!canvas) return

    exportRegistrar.register({ kind: 'canvas', getCanvas: () => canvas })

    return () => {
      exportRegistrar.register(null)
    }
  })

  // Create a render scheduler function
  function scheduleRender() {
    if (!canvasState.renderScheduled && browser) {
      canvasState.renderScheduled = true
      requestAnimationFrame(() => {
        if (canvasState.canvas && canvasState.context) {
          renderCanvas()
        }
        canvasState.renderScheduled = false
      })
    }
  }

  // Calculate the auto max value from the matrix efficiently
  const effectiveMaxValue = $derived.by(() => {
    if (colorValueRange[1] !== 0) return colorValueRange[1]

    let maxValue = 0
    for (let i = 0; i < TransitionMatrix.length; i++) {
      const val = TransitionMatrix[i]
      if (val > maxValue) maxValue = val
    }
    return Math.ceil(maxValue)
  })

  // Consolidated layout object to avoid multiple derived checks and grouping related metrics
  const layout = $derived.by(() => {
    // 1. Initial cell size estimate for font scaling
    const aoiCount = aoiLabels.length
    const estYSpace = MAX_LABEL_LENGTH + 40
    const estXSpace = MAX_LABEL_LENGTH + 40
    const estLegSpace = 50

    const preCellSize = Math.max(
      MIN_CELL_SIZE,
      Math.min(
        (width - estYSpace - marginLeft - marginRight) / Math.max(1, aoiCount),
        (height - estXSpace - marginTop - marginBottom - estLegSpace) /
          Math.max(1, aoiCount)
      )
    )

    const fontSize = Math.min(12, Math.max(8, preCellSize / 3))
    const axisLabelMargin = Math.max(10, Math.round(fontSize * 1.67))
    const individualLabelMargin = Math.max(5, Math.round(fontSize * 0.83))

    // Calculate label offset based on actually used labels
    const offset = Math.min(
      MAX_LABEL_LENGTH,
      calculateLabelOffset(aoiLabels, fontSize, BASE_LABEL_OFFSET)
    )

    const yAxisSpace = LEFT_MARGIN + offset + axisLabelMargin + marginLeft
    const xAxisSpace = TOP_MARGIN + offset + axisLabelMargin + marginTop
    const legendSpace = 50 + marginBottom

    const availableWidth = width - yAxisSpace - marginRight
    const availableHeight = height - xAxisSpace - legendSpace

    const cellSize =
      aoiCount === 0
        ? MIN_CELL_SIZE
        : Math.max(
            MIN_CELL_SIZE,
            Math.min(availableWidth / aoiCount, availableHeight / aoiCount)
          )

    const gridWidth = cellSize * aoiCount
    const gridHeight = cellSize * aoiCount

    const xOffset = yAxisSpace + ((availableWidth - gridWidth) >> 1)
    const yOffset = xAxisSpace + ((availableHeight - gridHeight) >> 1)

    return {
      fontSize,
      axisLabelMargin,
      individualLabelMargin,
      labelOffset: offset,
      xOffset,
      yOffset,
      cellSize,
      gridWidth,
      gridHeight,
      matrixBottom: yOffset + gridHeight,
    }
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
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = '#666'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No AOI data available', width >> 1, height >> 1)
      finishCanvasDrawing(canvasState)
      return
    }

    // Draw grid and cell labels
    drawGrid(ctx)

    // Draw the matrix cells
    drawCells(ctx)

    // Draw the legend
    drawLegend(ctx)

    // Set up font
    // TEXT RENDERING STARTS HERE
    setUpFont(ctx)

    // Draw axis labels
    drawAxisLabels(ctx)

    const labelFontSize = setUpLabelFont(ctx)

    // Draw row labels
    drawRowLabels(ctx, labelFontSize)

    // Draw column labels
    drawColumnLabels(ctx, labelFontSize)

    // Draw cells text
    drawCellsText(ctx)

    // ---- STOP OF TEXT DRAWING ---- //

    // Finish drawing
    finishCanvasDrawing(canvasState)
  }

  function setUpFont(ctx: CanvasRenderingContext2D) {
    ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
    ctx.fillStyle = '#222'
  }

  // Draw the X and Y axis labels
  function drawAxisLabels(ctx: CanvasRenderingContext2D) {
    // make sure setUpFont function is called before this function is called!
    ctx.textBaseline = 'middle'

    // Draw X-axis label (To AOI)
    ctx.textAlign = 'center'
    ctx.fillText(
      xLabel,
      layout.xOffset + (layout.gridWidth >> 1),
      layout.yOffset - layout.labelOffset - layout.axisLabelMargin
    )

    // Draw Y-axis label (From AOI)
    ctx.save()
    ctx.translate(
      layout.xOffset - layout.labelOffset - layout.axisLabelMargin,
      layout.yOffset + (layout.gridHeight >> 1)
    )
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(yLabel, 0, 0)
    ctx.restore()
  }

  function setUpLabelFont(ctx: CanvasRenderingContext2D): number {
    // Use the pre-calculated font size for consistency
    ctx.font = `${layout.fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    return layout.fontSize
  }

  function drawRowLabels(ctx: CanvasRenderingContext2D, labelFontSize: number) {
    // Draw row labels (left side)
    ctx.textAlign = 'end'
    for (let row = 0; row < aoiLabels.length; row++) {
      const x = layout.xOffset - layout.individualLabelMargin
      const y = layout.yOffset + row * layout.cellSize + (layout.cellSize >> 1)

      // Truncate text if needed
      const labelText = truncateTextToPixelWidth(
        aoiLabels[row],
        MAX_LABEL_LENGTH,
        labelFontSize,
        SYSTEM_SANS_SERIF_STACK,
        '...'
      )

      ctx.fillText(labelText, x, y)
    }
  }

  function drawColumnLabels(
    ctx: CanvasRenderingContext2D,
    labelFontSize: number
  ) {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    for (let col = 0; col < aoiLabels.length; col++) {
      const x = layout.xOffset + col * layout.cellSize + (layout.cellSize >> 1)
      const y = layout.yOffset - layout.individualLabelMargin

      // Rotate labels if they're too long or there are too many
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-Math.PI / 4)
      ctx.fillText(
        truncateTextToPixelWidth(
          aoiLabels[col],
          MAX_LABEL_LENGTH * 1.5,
          labelFontSize,
          SYSTEM_SANS_SERIF_STACK,
          '...'
        ),
        0,
        0
      )
      ctx.restore()
    }
  }

  // Draw grid and labels
  function drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 0.5

    const { xOffset, yOffset, cellSize, gridWidth, gridHeight } = layout

    // Vertical grid lines
    for (let col = 0; col <= aoiLabels.length; col++) {
      const x = alignToPixelCenter(xOffset + col * cellSize)
      ctx.beginPath()
      ctx.moveTo(x, yOffset)
      ctx.lineTo(x, yOffset + gridHeight)
      ctx.stroke()
    }

    // Horizontal grid lines
    for (let row = 0; row <= aoiLabels.length; row++) {
      const y = alignToPixelCenter(yOffset + row * cellSize)
      ctx.beginPath()
      ctx.moveTo(xOffset, y)
      ctx.lineTo(xOffset + gridWidth, y)
      ctx.stroke()
    }
  }

  // Draw matrix cells
  function drawCells(ctx: CanvasRenderingContext2D) {
    const { xOffset, yOffset, cellSize } = layout
    const size = aoiLabels.length

    for (let row = 0; row < size; row++) {
      const rowOffset = row * size
      for (let col = 0; col < size; col++) {
        const value = TransitionMatrix[rowOffset + col] ?? 0
        const x = xOffset + col * cellSize
        const y = yOffset + row * cellSize

        let cellColor
        if (isBelowMinimum(value)) {
          cellColor = belowMinColor
        } else if (isAboveMaximum(value)) {
          cellColor = aboveMaxColor
        } else {
          cellColor = getColor(value)
        }

        ctx.fillStyle = cellColor
        ctx.fillRect(x, y, cellSize, cellSize)
      }
    }
  }

  function drawCellsText(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const { xOffset, yOffset, cellSize } = layout
    if (cellSize < 15) return
    const size = aoiLabels.length

    for (let row = 0; row < size; row++) {
      const rowOffset = row * size
      for (let col = 0; col < size; col++) {
        const value = TransitionMatrix[rowOffset + col] ?? 0

        const shouldShowValue =
          (!isBelowMinimum(value) && !isAboveMaximum(value)) ||
          (isBelowMinimum(value) && showBelowMinLabels) ||
          (isAboveMaximum(value) && showAboveMaxLabels)

        if (shouldShowValue) {
          const x = xOffset + col * cellSize
          const y = yOffset + row * cellSize
          let cellColor = isBelowMinimum(value)
            ? belowMinColor
            : isAboveMaximum(value)
              ? aboveMaxColor
              : getColor(value)

          ctx.fillStyle = getContrastTextColor(cellColor)
          ctx.fillText(
            value.toString(),
            x + (cellSize >> 1),
            y + (cellSize >> 1)
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
  function drawMinimalistLegend(
    ctx: CanvasRenderingContext2D,
    yPosition: number
  ) {
    const legendWidth = Math.min(300, layout.gridWidth * 0.8)
    const legendX = layout.xOffset + ((layout.gridWidth - legendWidth) >> 1)
    const gradientHeight = 8

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
    strokeCrispRect(
      ctx,
      legendX,
      yPosition,
      legendWidth,
      gradientHeight,
      '#666',
      1
    )

    // Draw title even in minimalist mode if some space exists (e.g. > 15px)
    if (yPosition - layout.matrixBottom > 15) {
      ctx.font = `10px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = '#000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(
        legendTitle,
        layout.xOffset + (layout.gridWidth >> 1),
        yPosition - 2
      )
    }

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
    const { yOffset, gridHeight, gridWidth, xOffset, matrixBottom } = layout
    const availableLegendSpace = height - matrixBottom - 10

    // If almost no space is available, draw a minimalist legend
    if (availableLegendSpace < 30) {
      drawMinimalistLegend(ctx, matrixBottom + 5)
      return
    }

    // Calculate legend position with available space
    const legendTop = matrixBottom + Math.min(25, availableLegendSpace * 0.25)
    const legendWidth = Math.min(300, gridWidth * 0.8)
    const legendX = xOffset + ((gridWidth - legendWidth) >> 1)

    // Legend components vertical positioning - more robust allocation
    const showTitle = availableLegendSpace >= 30
    const titleHeight = showTitle ? 15 : 0
    const padding = Math.max(2, (availableLegendSpace - titleHeight - 20) * 0.2) // Distribute remaining space

    const titleY = legendTop
    const gradientY = titleY + titleHeight + padding
    const gradientHeight = Math.min(
      12,
      Math.max(6, availableLegendSpace - titleHeight - padding - 15)
    )
    const valuesY = gradientY + gradientHeight + 4

    // The circle radius for value zones
    const valueRadius = Math.max(15, gradientHeight * 1.5)

    // Define interaction zones
    minValueZone = {
      x: legendX,
      y: valuesY + 6,
      radius: valueRadius,
    }

    maxValueZone = {
      x: legendX + legendWidth,
      y: valuesY + 6,
      radius: valueRadius,
    }

    gradientZone = {
      x: legendX - 10,
      y: gradientY - 10,
      width: legendWidth + 20,
      height: gradientHeight + 20,
      radius: 15,
    }

    // Draw hover effects based on the current hover state
    if (hoverState !== 'none') {
      const alpha = 0.2

      if (hoverState === 'minValue' && minValueZone) {
        ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`
        ctx.beginPath()
        ctx.arc(
          minValueZone.x,
          minValueZone.y,
          minValueZone.radius,
          0,
          Math.PI * 2
        )
        ctx.fill()
      } else if (hoverState === 'maxValue' && maxValueZone) {
        ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`
        ctx.beginPath()
        ctx.arc(
          maxValueZone.x,
          maxValueZone.y,
          maxValueZone.radius,
          0,
          Math.PI * 2
        )
        ctx.fill()
      } else if (hoverState === 'gradient' && gradientZone) {
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

    // Draw legend title if there's any room
    if (showTitle) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = '#000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(legendTitle, xOffset + (gridWidth >> 1), titleY)
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
      gradient.addColorStop(0, colorScale[0] || '#fff')
      gradient.addColorStop(1, colorScale[1] || '#000')
    }

    // Draw gradient rectangle
    ctx.fillStyle = gradient
    ctx.fillRect(legendX, gradientY, legendWidth, gradientHeight)

    // Draw border around gradient
    strokeCrispRect(
      ctx,
      legendX,
      gradientY,
      legendWidth,
      gradientHeight,
      '#666',
      1
    )

    // Draw min and max values if there's room
    if (availableLegendSpace > 35) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
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

  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)
    const oldHoverState = hoverState

    const { xOffset, yOffset, cellSize } = layout
    const col = Math.floor((mouseX - xOffset) / cellSize)
    const row = Math.floor((mouseY - yOffset) / cellSize)

    const isOverCell =
      row >= 0 && row < aoiLabels.length && col >= 0 && col < aoiLabels.length

    // If over a cell, show tooltip and clear hover state
    if (isOverCell) {
      const size = aoiLabels.length
      const value = TransitionMatrix[row * size + col] ?? 0
      const x = xOffset + col * cellSize
      const y = yOffset + row * cellSize

      const tooltipPos = getTooltipPosition(
        canvasState,
        x + cellSize,
        y + (cellSize >> 1),
        { x: 10, y: 0 }
      )

      updateTooltip({
        x: tooltipPos.x,
        y: tooltipPos.y,
        content: [
          { key: 'From', value: aoiLabels[row] },
          { key: 'To', value: aoiLabels[col] },
          { key: 'Value', value: value.toString() },
        ],
        visible: true,
        width: 150,
      })

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
        const tooltipPos = getTooltipPosition(
          canvasState,
          minValueZone.x,
          minValueZone.y + minValueZone.radius,
          { x: 0, y: 5 }
        )
        updateTooltip({
          x: tooltipPos.x,
          y: tooltipPos.y,
          content: [{ key: '', value: 'Modify min value' }],
          visible: true,
        })
      }
      // Check max value circle
      else if (
        maxValueZone &&
        Math.hypot(mouseX - maxValueZone.x, mouseY - maxValueZone.y) <=
          maxValueZone.radius
      ) {
        hoverState = 'maxValue'
        const tooltipPos = getTooltipPosition(
          canvasState,
          maxValueZone.x,
          maxValueZone.y + maxValueZone.radius,
          { x: 0, y: 5 }
        )
        updateTooltip({
          x: tooltipPos.x,
          y: tooltipPos.y,
          content: [{ key: '', value: 'Modify max value' }],
          visible: true,
        })
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
        const tooltipPos = getTooltipPosition(
          canvasState,
          gradientZone.x + (gradientZone.width >> 1),
          gradientZone.y + gradientZone.height,
          { x: 115 / -2, y: 5 } // Half of the tooltip width (110/2) to center it
        )
        updateTooltip({
          x: tooltipPos.x,
          y: tooltipPos.y,
          content: [{ key: '', value: 'Change color scale' }],
          visible: true,
        })
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

<canvas
  bind:this={canvas}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  onmousedown={handleMouseDown}
></canvas>
