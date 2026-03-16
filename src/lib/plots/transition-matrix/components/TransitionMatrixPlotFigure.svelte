<script lang="ts">
  import { getColorForValue, getContrastTextColor } from '$lib/color/utility'
  import { updateTooltip } from '$lib/tooltip'
  import {
    truncateTextToPixelWidth,
    SYSTEM_SANS_SERIF_STACK,
  } from '$lib/shared/utils/textUtils'
  import { getContext, untrack } from 'svelte'
  import {
    createCanvasState,
    getScaledMousePosition,
    getTooltipPosition,
    beginCanvasDrawing,
    finishCanvasDrawing,
    alignToPixelCenter,
    createRenderScheduler,
    canvasLifecycleAction,
    refreshCanvasLifecycle,
  } from '$lib/plots/shared/canvasUtils'
  import type { CanvasState } from '$lib/plots/shared/canvasUtils'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
    registerCanvasExportSource,
  } from '$lib/data/export'
  import {
    TRANSITION_MATRIX_LAYOUT,
    TRANSITION_MATRIX_DEFAULTS,
  } from '../const'
  import { computeTransitionMatrixLayout } from '../core/layout'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
    drawPlotOutline,
  } from '$lib/plots/shared'
  import { UI_COLORS } from '$lib/color'

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
    height = TRANSITION_MATRIX_DEFAULTS.height,
    width = TRANSITION_MATRIX_DEFAULTS.width,
    colorScale = [...TRANSITION_MATRIX_DEFAULTS.colorScale],
    xLabel = TRANSITION_MATRIX_DEFAULTS.xLabel,
    yLabel = TRANSITION_MATRIX_DEFAULTS.yLabel,
    legendTitle = 'Transition Count',
    colorValueRange = [0, 0],
    belowMinColor = TRANSITION_MATRIX_DEFAULTS.inactiveColor,
    aboveMaxColor = TRANSITION_MATRIX_DEFAULTS.inactiveColor,
    showBelowMinLabels = false,
    showAboveMaxLabels = false,
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
    colorScale?: string[]
    xLabel?: string
    yLabel?: string
    legendTitle?: string
    colorValueRange: [number, number]
    belowMinColor?: string
    aboveMaxColor?: string
    showBelowMinLabels?: boolean
    showAboveMaxLabels?: boolean
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
    return registerCanvasExportSource(exportRegistrar, () => canvas)
  })

  const getCanvasDimensions = () => ({
    width: width + marginLeft + marginRight,
    height: height + marginTop + marginBottom,
  })

  const scheduleRender = createRenderScheduler(() => canvasState, renderCanvas)

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

  // Consolidated layout object
  const layout = $derived.by(() =>
    computeTransitionMatrixLayout({
      width,
      height,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      aoiLabels,
      effectiveMaxValue,
    })
  )

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
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
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

    // Draw the plot area border
    drawPlotOutline(
      ctx,
      layout.xOffset,
      layout.yOffset,
      layout.gridWidth,
      layout.gridHeight
    )

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
    ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
  }

  // 5. IMPROVEMENT: Updated Draw Function
  function drawAxisLabels(ctx: CanvasRenderingContext2D) {
    setUpFont(ctx) // Ensure font is set (12px sans-serif usually)

    const unitText = layout.isCompactMode ? '[order indices]' : '[names]'
    const {
      xOffset,
      yOffset,
      gridWidth,
      gridHeight,
      xAxisLabelHeight,
      yAxisLabelWidth,
      axisTitleGap,
    } = layout

    // --- Draw X-axis label (To AOI) ---
    // Position: Top of the chart area
    ctx.textAlign = 'center'

    // Key Change: Anchor Bottom.
    // This allows us to place the text exactly `gap` pixels above the rotated labels.
    ctx.textBaseline = 'bottom'

    // Y Position = (Start of Matrix) - (Height of Rotated Labels) - (Gap)
    const xTitleY = yOffset - xAxisLabelHeight - axisTitleGap

    ctx.fillText(`${xLabel} ${unitText}`, xOffset + gridWidth * 0.5, xTitleY)

    // --- Draw Y-axis label (From AOI) ---
    // Position: Left of the chart area, rotated -90 degrees
    ctx.save()

    // 1. Move to vertical center of grid
    // 2. Move left by (Width of Labels) + (Gap)
    const yTitleX = xOffset - yAxisLabelWidth - axisTitleGap
    const yTitleY = yOffset + gridHeight * 0.5

    ctx.translate(yTitleX, yTitleY)
    ctx.rotate(-Math.PI / 2)

    // Key Change: Anchor Bottom.
    // Because we rotated -90deg, 'bottom' visually faces the chart (the right side of the text).
    // This creates symmetry: "Bottom of text touches the Gap line" for both axes.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    ctx.fillText(`${yLabel} ${unitText}`, 0, 0)
    ctx.restore()
  }

  function setUpLabelFont(ctx: CanvasRenderingContext2D): number {
    // Use the pre-calculated font size for consistency
    ctx.font = `${layout.fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    return layout.fontSize
  }

  function drawRowLabels(ctx: CanvasRenderingContext2D, labelFontSize: number) {
    if (!layout.showAxisLabels) return
    // Draw row labels (left side)
    ctx.textAlign = 'end'
    ctx.textBaseline = 'middle'
    for (let row = 0; row < aoiLabels.length; row++) {
      let shouldSkip = false
      if (layout.isUltraCompactMode) {
        if (row % layout.thinFactor !== 0) shouldSkip = true
      } else if (layout.isCompactMode) {
        if ((row + 1) % layout.thinFactor !== 0) shouldSkip = true
      }
      if (shouldSkip) continue

      const x = layout.xOffset - layout.individualLabelMargin
      const y =
        layout.yOffset + row * layout.cellSize + layout.cellSize * 0.5 + 1

      const isNoAoi = row === aoiLabels.length - 1

      // Draw small ticks for ultra-compact mode
      if (layout.isUltraCompactMode) {
        ctx.beginPath()
        ctx.moveTo(layout.xOffset, y - 1)
        ctx.lineTo(layout.xOffset - 4, y - 1)
        ctx.strokeStyle = UI_COLORS.TEXT_SECONDARY
        ctx.stroke()
      }

      const labelText = layout.isCompactMode
        ? isNoAoi
          ? 'Ø'
          : layout.isUltraCompactMode
            ? row.toString() // Zero-based index for cleaner ticks like Scarf? Scarf uses 'i' which looks like 0, 5, 10. Let's use row index.
            : (row + 1).toString()
        : truncateTextToPixelWidth(
            aoiLabels[row],
            TRANSITION_MATRIX_LAYOUT.maxLabelLength,
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
    if (!layout.showAxisLabels) return
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    for (let col = 0; col < aoiLabels.length; col++) {
      let shouldSkip = false
      if (layout.isUltraCompactMode) {
        if (col % layout.thinFactor !== 0) shouldSkip = true
      } else if (layout.isCompactMode) {
        if ((col + 1) % layout.thinFactor !== 0) shouldSkip = true
      }
      if (shouldSkip) continue

      const x = layout.xOffset + col * layout.cellSize + layout.cellSize * 0.5
      const y = layout.yOffset - layout.individualLabelMargin

      // Draw small ticks for ultra-compact mode
      if (layout.isUltraCompactMode) {
        ctx.beginPath()
        ctx.moveTo(x, layout.yOffset)
        ctx.lineTo(x, layout.yOffset - 4)
        ctx.strokeStyle = UI_COLORS.TEXT_SECONDARY
        ctx.stroke()
      }

      // Rotate labels if they're too long or there are too many
      ctx.save()
      ctx.translate(x, y)
      // Rotated for names, vertical/straight for indices
      if (!layout.isCompactMode) {
        ctx.rotate(-Math.PI / 4)
      } else {
        ctx.textAlign = 'center'
        // Vertical offset for straight labels
        ctx.textBaseline = 'bottom'
      }

      const labelText = layout.isCompactMode
        ? col === aoiLabels.length - 1
          ? 'Ø'
          : layout.isUltraCompactMode
            ? col.toString()
            : (col + 1).toString()
        : truncateTextToPixelWidth(
            aoiLabels[col],
            TRANSITION_MATRIX_LAYOUT.maxLabelLength * 1.5,
            labelFontSize,
            SYSTEM_SANS_SERIF_STACK,
            '...'
          )

      ctx.fillText(labelText, 0, 0)
      ctx.restore()
    }
  }

  // Draw grid and labels
  function drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = UI_COLORS.BORDER_DEFAULT
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
    if (!layout.showCellValues) return

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const { xOffset, yOffset, cellSize, cellValueFontSize } = layout
    ctx.font = `${cellValueFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
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
          const displayValue = Number.isInteger(value)
            ? value.toString()
            : value.toFixed(1)

          let cellColor
          if (isBelowMinimum(value)) {
            cellColor = belowMinColor
          } else if (isAboveMaximum(value)) {
            cellColor = aboveMaxColor
          } else {
            cellColor = getColor(value)
          }

          ctx.fillStyle = getContrastTextColor(cellColor)

          const x = xOffset + col * cellSize
          const y = yOffset + row * cellSize

          ctx.fillText(displayValue, x + cellSize * 0.5, y + cellSize * 0.5 + 1)
        }
      }
    }
  }

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

  // Legend geometry computed via shared utility
  const legendGeometry = $derived.by(() => {
    const { yOffset, gridHeight, gridWidth, xOffset, matrixBottom } = layout
    const availableLegendSpace = height - matrixBottom - 10

    return computeGradientLegendGeometry({
      x: xOffset,
      y: matrixBottom + 5,
      availableWidth: gridWidth,
      availableHeight: availableLegendSpace,
      colorScale,
      valueRange: colorValueRange,
      effectiveMaxValue,
      title: legendTitle,
    })
  })

  // Draw the color legend
  function drawLegend(ctx: CanvasRenderingContext2D) {
    if (legendGeometry) {
      drawGradientLegend(ctx, legendGeometry, {
        x: 0, // unused by draw
        y: 0,
        availableWidth: 0,
        availableHeight: 0,
        colorScale,
        valueRange: colorValueRange,
        effectiveMaxValue,
        title: legendTitle,
      })
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

    const { xOffset, yOffset, cellSize } = layout
    const col = Math.floor((mouseX - xOffset) / cellSize)
    const row = Math.floor((mouseY - yOffset) / cellSize)

    const isOverCell =
      row >= 0 && row < aoiLabels.length && col >= 0 && col < aoiLabels.length

    // If over a cell, show tooltip
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
        id: 'transition-matrix-tooltip',
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
    } else {
      updateTooltip(null)
    }

    // Update cursor style
    if (canvas) {
      canvas.style.cursor = isOverCell ? 'pointer' : 'default'
    }
  }

  function handleMouseLeave() {
    updateTooltip(null)
    if (canvas) canvas.style.cursor = 'default'
  }

  function handleMouseDown(event: MouseEvent) {
    // Legacy shortcuts removed
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
      refreshCanvasLifecycle({
        getState: () => canvasState,
        setState: newState => {
          canvasState = newState
        },
        getDimensions: getCanvasDimensions,
        getDpiOverride: () => dpiOverride,
        scheduleRender,
      })
    })
  })

</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={{
    getState: () => canvasState,
    setState: newState => {
      canvasState = newState
    },
    getDimensions: getCanvasDimensions,
    getDpiOverride: () => dpiOverride,
    render: renderCanvas,
    scheduleRender,
  }}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  onmousedown={handleMouseDown}
></canvas>
