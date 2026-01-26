<script lang="ts">
  import {
    getColorForValue,
    getContrastTextColor,
  } from '$lib/shared/utils/colorUtils'
  import { updateTooltip } from '$lib/tooltip'
  import {
    truncateTextToPixelWidth,
    SYSTEM_SANS_SERIF_STACK,
  } from '$lib/shared/utils/textUtils'
  import { getContext, onMount, untrack } from 'svelte'
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
  } from '$lib/shared/utils/canvasUtils'
  import type { CanvasState } from '$lib/shared/utils/canvasUtils'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
  } from '$lib/data/export'
  import {
    TRANSITION_MATRIX_LAYOUT,
    TRANSITION_MATRIX_DEFAULTS,
  } from '../const'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
    hitTestGradientLegend,
    drawPlotOutline,
  } from '$lib/plots/shared'

  function calculateTickStep(len: number): number {
    const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
    for (const s of niceSteps) {
      if (len / s <= 10) return s
    }
    return 1000
  }

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
    colorScale?: string[]
    xLabel?: string
    yLabel?: string
    legendTitle?: string
    colorValueRange: [number, number]
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

  // 1. IMPROVEMENT: Define a consistent optical gap constant
  const AXIS_TITLE_GAP = 12 // Pixels between Axis Title and Axis Labels

  // Consolidated layout object
  const layout = $derived.by(() => {
    const aoiCount = aoiLabels.length
    const fontSize = TRANSITION_MATRIX_LAYOUT.LABEL_FONT_SIZE

    // 2. MEASURING TOOL: Calculate precise text geometry
    // Estimate max text width based on avg char width (approx 0.6em) or use max allowed
    // Note: In a perfect world, we'd use ctx.measureText, but for layout calculation
    // before render, this heuristic combined with truncation logic is robust.
    const approxCharWidth = fontSize * 0.6
    let maxPixelWidth = 0

    // Find longest label width
    for (const label of aoiLabels) {
      const width = label.length * approxCharWidth
      if (width > maxPixelWidth) maxPixelWidth = width
    }

    // Cap it at the truncation limit defined in your constants
    const effectiveMaxLabelWidth = Math.min(
      maxPixelWidth,
      TRANSITION_MATRIX_LAYOUT.maxLabelLength
    )

    // 3. IMPROVEMENT: Calculate layout mode and offsets correctly
    // Step 1: Check Standard Fit
    const standardAxisLabelSize = effectiveMaxLabelWidth
    const standardXAxisHeight =
      standardAxisLabelSize * 0.7071 + fontSize * 0.7071 // Rotated

    const standardYSpace =
      marginLeft +
      TRANSITION_MATRIX_LAYOUT.leftMargin +
      fontSize +
      AXIS_TITLE_GAP +
      standardAxisLabelSize +
      10

    const standardXSpace =
      marginTop +
      TRANSITION_MATRIX_LAYOUT.topMargin +
      fontSize +
      AXIS_TITLE_GAP +
      standardXAxisHeight +
      10

    const legendSpace = 70 + marginBottom

    const availableWidthStandard =
      width -
      standardYSpace -
      marginRight -
      TRANSITION_MATRIX_LAYOUT.rightMargin
    const availableHeightStandard = height - standardXSpace - legendSpace

    const cellStandard = Math.max(
      0,
      Math.min(
        availableWidthStandard / Math.max(1, aoiCount),
        availableHeightStandard / Math.max(1, aoiCount)
      )
    )

    const needsCompact =
      cellStandard < TRANSITION_MATRIX_LAYOUT.COMPACT_THRESHOLD

    // Step 2: Check Extended/Ultra Fit
    // If needsCompact is true, we use smaller headers, potentially freeing up space.
    // If that freed up space still results in cells < 20px, we go Ultra.
    const compactLabelSize = 25
    const compactYSpace =
      marginLeft +
      TRANSITION_MATRIX_LAYOUT.leftMargin +
      fontSize +
      AXIS_TITLE_GAP +
      compactLabelSize +
      10
    const compactXSpace =
      marginTop +
      TRANSITION_MATRIX_LAYOUT.topMargin +
      fontSize +
      AXIS_TITLE_GAP +
      compactLabelSize +
      10

    const activeYSpace = needsCompact ? compactYSpace : standardYSpace
    const activeXSpace = needsCompact ? compactXSpace : standardXSpace

    const availableWidthReal =
      width - activeYSpace - marginRight - TRANSITION_MATRIX_LAYOUT.rightMargin
    const availableHeightReal = height - activeXSpace - legendSpace

    const cellReal = Math.max(
      0,
      Math.min(
        availableWidthReal / Math.max(1, aoiCount),
        availableHeightReal / Math.max(1, aoiCount)
      )
    )

    const isUltraCompactMode = cellReal < TRANSITION_MATRIX_LAYOUT.minCellSize
    const isCompactMode = needsCompact || isUltraCompactMode

    // 4. IMPROVEMENT: Geometric Spacing Calculation
    // Calculate exact space needed for X and Y axis labels
    let xAxisLabelHeight: number
    let yAxisLabelWidth: number

    if (isCompactMode) {
      // Compact: Indices are small and essentially square
      xAxisLabelHeight = 25
      yAxisLabelWidth = 25
    } else {
      // Standard:
      // Y-axis labels are horizontal. Space = Width.
      yAxisLabelWidth = effectiveMaxLabelWidth

      // X-axis labels are rotated 45 degrees.
      // Height = (Width * sin(45)) + (FontHeight * cos(45))
      const sin45 = 0.7071
      xAxisLabelHeight = effectiveMaxLabelWidth * sin45 + fontSize * sin45
    }

    // Apply the constant gap
    const yAxisSpace =
      marginLeft +
      TRANSITION_MATRIX_LAYOUT.leftMargin +
      fontSize + // Space for Title Text Height
      AXIS_TITLE_GAP +
      yAxisLabelWidth +
      10 // Small padding next to matrix

    const xAxisSpace =
      marginTop +
      TRANSITION_MATRIX_LAYOUT.topMargin +
      fontSize + // Space for Title Text Height
      AXIS_TITLE_GAP +
      xAxisLabelHeight +
      10 // Small padding next to matrix

    // Remaining layout logic...
    const availableWidth =
      width - yAxisSpace - marginRight - TRANSITION_MATRIX_LAYOUT.rightMargin
    const availableHeight = height - xAxisSpace - legendSpace

    const cellSize =
      aoiCount === 0
        ? TRANSITION_MATRIX_LAYOUT.minCellSize
        : Math.floor(
            isUltraCompactMode
              ? Math.max(
                  1,
                  Math.min(
                    availableWidth / aoiCount,
                    availableHeight / aoiCount
                  )
                )
              : Math.max(
                  TRANSITION_MATRIX_LAYOUT.minCellSize,
                  Math.min(
                    availableWidth / aoiCount,
                    availableHeight / aoiCount
                  )
                )
          )

    const gridWidth = cellSize * aoiCount
    const gridHeight = cellSize * aoiCount

    const xOffset = Math.floor(yAxisSpace + ((availableWidth - gridWidth) >> 1))
    const yOffset = Math.floor(xAxisSpace)

    // 5. IMPROVEMENT: Dynamic thinning for axis labels (indices)
    let thinFactor = 1
    let showAxisLabels = true

    if (isUltraCompactMode) {
      thinFactor = calculateTickStep(aoiCount)
    } else if (isCompactMode) {
      const maxIndexStr = aoiCount.toString()
      const approxIndexWidth = maxIndexStr.length * (fontSize * 0.6)
      // Factor is: How many cells we need to fit the widest index plus a 4px cushion
      thinFactor = Math.max(1, Math.ceil((approxIndexWidth + 4) / cellSize))

      // If thinning is so high that we'd only show like 2 labels or cells are tiny,
      // we might want to hide them, but for now let's just ensure they fit.
      if (cellSize < 5) showAxisLabels = false
    }

    // 6. IMPROVEMENT: Two-pass cell label visibility & scaling
    const formatValue = (v: number) =>
      Number.isInteger(v) ? v.toString() : v.toFixed(1)
    const valueStr = formatValue(effectiveMaxValue)
    const labelLen = Math.max(valueStr.length, effectiveMaxValue < 1 ? 3 : 0)

    const defaultCellFontSize = TRANSITION_MATRIX_LAYOUT.CELL_VALUE_FONT_SIZE
    const reducedCellFontSize = defaultCellFontSize - 2

    let activeCellValueFontSize: number = defaultCellFontSize
    let showCellValues = false

    // Pass 1: Try default size with 6px cushion
    const widthPass1 = labelLen * (defaultCellFontSize * 0.75)
    if (
      !isUltraCompactMode &&
      cellSize >= widthPass1 + 6 &&
      cellSize >= defaultCellFontSize + 4
    ) {
      showCellValues = true
      activeCellValueFontSize = defaultCellFontSize
    } else {
      // Pass 2: Try reduced size with 4px cushion
      const widthPass2 = labelLen * (reducedCellFontSize * 0.75)
      if (
        !isUltraCompactMode &&
        cellSize >= widthPass2 + 4 &&
        cellSize >= reducedCellFontSize + 2
      ) {
        showCellValues = true
        activeCellValueFontSize = reducedCellFontSize
      }
    }

    return {
      fontSize,
      // We expose these calculated bounds for the drawing function
      xAxisLabelHeight,
      yAxisLabelWidth,
      axisTitleGap: AXIS_TITLE_GAP,
      xOffset,
      yOffset,
      cellSize,
      gridWidth,
      gridHeight,
      matrixBottom: yOffset + gridHeight,
      isCompactMode,
      isUltraCompactMode,
      thinFactor,
      individualLabelMargin: 10,
      showCellValues,
      showAxisLabels,
      cellValueFontSize: activeCellValueFontSize,
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
    ctx.fillStyle = '#222'
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
        ctx.strokeStyle = '#666'
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
        ctx.strokeStyle = '#666'
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
          const x = xOffset + col * cellSize
          const y = yOffset + row * cellSize
          let cellColor = isBelowMinimum(value)
            ? belowMinColor
            : isAboveMaximum(value)
              ? aboveMaxColor
              : getColor(value)

          ctx.fillStyle = getContrastTextColor(cellColor)
          const displayValue = Number.isInteger(value)
            ? value.toString()
            : value.toFixed(1)

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
      drawGradientLegend(
        ctx,
        legendGeometry,
        {
          x: 0, // unused by draw
          y: 0,
          availableWidth: 0,
          availableHeight: 0,
          colorScale,
          valueRange: colorValueRange,
          effectiveMaxValue,
          title: legendTitle,
        },
        hoverState
      )
    }
  }

  // Tracking for legend hover effect
  let hoverState = $state<'none' | 'gradient' | 'minValue' | 'maxValue'>('none')

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
    } else {
      // Check legend interactions
      hoverState = hitTestGradientLegend(mouseX, mouseY, legendGeometry.zones)

      if (hoverState !== 'none') {
        let tooltipX = 0
        let tooltipY = 0
        let msg = ''
        let hasZone = false

        if (hoverState === 'gradient' && legendGeometry.zones.gradientZone) {
          const z = legendGeometry.zones.gradientZone
          tooltipX = z.x + (z.width >> 1)
          tooltipY = z.y + z.height
          msg = 'Change color scale'
          hasZone = true
        } else if (
          hoverState === 'minValue' &&
          legendGeometry.zones.minValueZone
        ) {
          const z = legendGeometry.zones.minValueZone
          tooltipX = z.x
          tooltipY = z.y + z.radius
          msg = 'Modify min value'
          hasZone = true
        } else if (
          hoverState === 'maxValue' &&
          legendGeometry.zones.maxValueZone
        ) {
          const z = legendGeometry.zones.maxValueZone
          tooltipX = z.x
          tooltipY = z.y + z.radius
          msg = 'Modify max value'
          hasZone = true
        }

        if (hasZone) {
          const tooltipPos = getTooltipPosition(
            canvasState,
            tooltipX,
            tooltipY,
            { x: 0, y: 5 }
          )

          updateTooltip({
            x: tooltipPos.x,
            y: tooltipPos.y,
            content: [{ key: '', value: msg }],
            visible: true,
          })
        }
      } else {
        updateTooltip(null)
      }
    }

    // Update cursor style
    if (canvas) {
      canvas.style.cursor =
        hoverState !== 'none' || isOverCell ? 'pointer' : 'default'
    }

    if (hoverState !== oldHoverState) {
      scheduleRender() // Force redraw
    }
  }

  function handleMouseLeave() {
    updateTooltip(null)
    const oldHoverState = hoverState
    hoverState = 'none'
    if (canvas) canvas.style.cursor = 'default'
    if (oldHoverState !== 'none') scheduleRender()
  }

  function handleMouseDown(event: MouseEvent) {
    if (!canvas) return
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

    const hit = hitTestGradientLegend(mouseX, mouseY, legendGeometry.zones)

    if (hit === 'minValue') {
      onValueClick(true)
    } else if (hit === 'maxValue') {
      onValueClick(false)
    } else if (hit === 'gradient') {
      onGradientClick()
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
