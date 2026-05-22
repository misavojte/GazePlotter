<script lang="ts">
  import { getColorForValue } from '$lib/color/utility'
  import { updateTooltip } from '$lib/tooltip'
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import { untrack } from 'svelte'
  import {
    getScaledMousePosition,
    getTooltipPosition,
    beginCanvasDrawing,
    finishCanvasDrawing,
    canvasLifecycleAction,
  } from '$lib/plots/shared/canvasUtils'
  import { drawCanvasPlaceholder, METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    TRANSITION_MATRIX_LAYOUT,
    TRANSITION_MATRIX_DEFAULTS,
  } from '../const'
  import { computeTransitionMatrixLayout } from '../core/layout'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
    drawPlotArea,
    useCanvasPlot,
    renderMatrixContent,
    canvasBlockSelect,
    type BlockedRegion,
    type MatrixRenderConfig,
  } from '$lib/plots/shared'
  import { UI_COLORS } from '$lib/color'

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
    noMetric = false,
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
    noMetric?: boolean
  }>()

  let canvas = $state<HTMLCanvasElement | null>(null)

  const plot = useCanvasPlot({
    render: renderCanvas,
    getWidth: () => width,
    getHeight: () => height,
    getMargins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    getDpiOverride: () => dpiOverride,
  })

  const effectiveMaxValue = $derived.by(() => {
    if (colorValueRange[1] !== 0) return colorValueRange[1]

    let maxValue = 0
    for (let i = 0; i < TransitionMatrix.length; i++) {
      const val = TransitionMatrix[i]
      if (val > maxValue) maxValue = val
    }
    return Math.ceil(maxValue)
  })

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

  // The matrix body is the only blocked region: its gradient legend is
  // static (no clickable cells), so chrome around either one — title,
  // axis labels, padding, the legend itself — stays selectable.
  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    if (noMetric || aoiLabels.length === 0) return []
    return [
      {
        x: layout.xOffset,
        y: layout.yOffset,
        w: layout.gridWidth,
        h: layout.gridHeight,
      },
    ]
  })

  function isBelowMinimum(value: number): boolean {
    return value < colorValueRange[0]
  }

  function isAboveMaximum(value: number): boolean {
    return value > effectiveMaxValue && colorValueRange[1] !== 0
  }

  function getColor(value: number): string {
    return getColorForValue(
      value,
      colorValueRange[0],
      effectiveMaxValue,
      colorScale
    )
  }

  function getCellColor(value: number): string {
    // Non-finite (NaN / ±Infinity) marks a cell where the metric is undefined
    // for this row/column — e.g. transitionProbability for a source AOI with
    // no outgoing transitions (division by zero). Render as out-of-bounds so
    // it's visually distinct from a real zero.
    if (!Number.isFinite(value)) return belowMinColor
    if (isBelowMinimum(value)) return belowMinColor
    if (isAboveMaximum(value)) return aboveMaxColor
    return getColor(value)
  }

  const renderConfig = $derived<MatrixRenderConfig>({
    layout,
    labels: aoiLabels,
    matrix: TransitionMatrix,
    maxLabelLength: TRANSITION_MATRIX_LAYOUT.maxLabelLength,
    xAxisTitle: xLabel,
    yAxisTitle: yLabel,
    compactUnitText: '[order indices]',
    standardUnitText: '[names]',
    formatCellValue: (v: number) =>
      Number.isInteger(v) ? v.toString() : v.toFixed(1),
    getCellColor,
    showCellValue: (v: number) =>
      Number.isFinite(v) &&
      ((!isBelowMinimum(v) && !isAboveMaximum(v)) ||
       (isBelowMinimum(v) && showBelowMinLabels) ||
       (isAboveMaximum(v) && showAboveMaxLabels)),
    hasLastRowSentinel: true,
  })

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)
    const ctx = plot.canvasState.context
    if (!ctx) return

    if (noMetric) {
      drawCanvasPlaceholder(ctx, width, height, METRIC_MISSING_MESSAGE)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    if (aoiLabels.length === 0) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No AOI data available', width >> 1, height >> 1)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    renderMatrixContent(ctx, renderConfig)

    drawPlotArea(ctx, {
      x: layout.xOffset,
      y: layout.yOffset,
      width: layout.gridWidth,
      height: layout.gridHeight,
    })

    drawLegend(ctx)

    finishCanvasDrawing(plot.canvasState)
  }

  const legendGeometry = $derived.by(() => {
    const { gridWidth, xOffset, matrixBottom } = layout
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

  function drawLegend(ctx: CanvasRenderingContext2D) {
    if (legendGeometry) {
      drawGradientLegend(ctx, legendGeometry, {
        x: 0,
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
    const { x: mouseX, y: mouseY } = getScaledMousePosition(plot.canvasState, event)

    const { xOffset, yOffset, cellSize } = layout
    const col = Math.floor((mouseX - xOffset) / cellSize)
    const row = Math.floor((mouseY - yOffset) / cellSize)

    const isOverCell =
      row >= 0 && row < aoiLabels.length && col >= 0 && col < aoiLabels.length

    if (isOverCell) {
      const size = aoiLabels.length
      const value = TransitionMatrix[row * size + col] ?? 0
      const x = xOffset + col * cellSize
      const y = yOffset + row * cellSize

      const tooltipPos = getTooltipPosition(
        plot.canvasState,
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
          { key: 'Value', value: Number.isFinite(value) ? value.toString() : '—' },
        ],
        visible: true,
        width: 150,
      })
    } else {
      updateTooltip(null)
    }

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

  $effect(() => {
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

    untrack(() => plot.refresh())
  })

</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={plot.actionOptions}
  use:canvasBlockSelect={{ regions: blockedRegions }}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  onmousedown={handleMouseDown}
></canvas>
