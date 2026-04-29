<script lang="ts">
  import { getColorForValue } from '$lib/color/utility'
  import { updateTooltip } from '$lib/tooltip'
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import {
    drawCanvasPlaceholder,
    METRIC_MISSING_MESSAGE,
  } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { untrack } from 'svelte'
  import {
    getScaledMousePosition,
    getTooltipPosition,
    beginCanvasDrawing,
    finishCanvasDrawing,
    canvasLifecycleAction,
  } from '$lib/plots/shared/canvasUtils'
  import { SIMILARITY_MATRIX_LAYOUT } from '../const'
  import { computeSimilarityMatrixLayout } from '../core/layout'
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
    matrix = new Float64Array(0),
    labels = [],
    height = 500,
    width = 500,
    colorScale = ['#f7fbff', '#08306b'],
    colorValueRange = [0, 1],
    legendTitle = 'Similarity',
    noMetric = false,
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  } = $props<{
    matrix: Float64Array
    labels: string[]
    height?: number
    width?: number
    colorScale?: string[]
    colorValueRange: [number, number]
    legendTitle?: string
    noMetric?: boolean
    dpiOverride?: number | null
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
  }>()

  let canvas = $state<HTMLCanvasElement | null>(null)

  const plot = useCanvasPlot({
    render: renderCanvas,
    getWidth: () => width,
    getHeight: () => height,
    getMargins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    getDpiOverride: () => dpiOverride,
  })

  $effect(() => plot.registerExportSource(() => canvas))

  const effectiveMaxValue = $derived.by(() => {
    if (colorValueRange[1] !== 0) return colorValueRange[1]
    let maxValue = 0
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i] > maxValue) maxValue = matrix[i]
    }
    return Math.ceil(maxValue * 100) / 100
  })

  const layout = $derived.by(() =>
    computeSimilarityMatrixLayout({
      width: width + marginLeft + marginRight,
      height: height + marginTop + marginBottom,
      labels,
      effectiveMaxValue,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    })
  )

  // Matrix body is the only blocked region — the gradient legend below
  // is static (no clickable cells), so it stays selectable chrome.
  const blockedRegions = $derived<BlockedRegion[]>([
    {
      x: layout.xOffset,
      y: layout.yOffset,
      w: layout.gridWidth,
      h: layout.gridHeight,
    },
  ])

  function getColor(value: number): string {
    return getColorForValue(
      value,
      colorValueRange[0],
      effectiveMaxValue,
      colorScale
    )
  }

  const renderConfig = $derived<MatrixRenderConfig>({
    layout,
    labels,
    matrix,
    maxLabelLength: SIMILARITY_MATRIX_LAYOUT.maxLabelLength,
    xAxisTitle: 'Participant',
    yAxisTitle: 'Participant',
    compactUnitText: '[indices]',
    standardUnitText: '[names]',
    formatCellValue: (v: number) => v.toFixed(2),
    getCellColor: getColor,
  })

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)
    const ctx = plot.canvasState.context
    if (!ctx) return

    // Empty-state branches: paint onto the canvas so exports include the
    // message instead of a blank PNG/SVG. `noMetric` (resolution failed)
    // takes priority over `labels.length === 0` (no participant data) since
    // the user's first action is fixing the metric, not the data.
    if (noMetric) {
      const cw = width + marginLeft + marginRight
      const ch = height + marginTop + marginBottom
      drawCanvasPlaceholder(ctx, cw, ch, METRIC_MISSING_MESSAGE)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    if (labels.length === 0) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const cw = width + marginLeft + marginRight
      const ch = height + marginTop + marginBottom
      ctx.fillText('No participant data available', cw >> 1, ch >> 1)
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
    const canvasHeight = height + marginTop + marginBottom
    const availableLegendSpace = canvasHeight - matrixBottom - 10

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
    const size = labels.length
    const isOverCell =
      row >= 0 && row < size && col >= 0 && col < size

    if (isOverCell) {
      const value = matrix[row * size + col] ?? 0
      const x = xOffset + col * cellSize
      const y = yOffset + row * cellSize
      const tooltipPos = getTooltipPosition(
        plot.canvasState,
        x + cellSize,
        y + (cellSize >> 1),
        { x: 10, y: 0 }
      )
      updateTooltip({
        id: 'similarity-matrix-tooltip',
        x: tooltipPos.x,
        y: tooltipPos.y,
        content: [
          { key: 'Row', value: labels[row] },
          { key: 'Column', value: labels[col] },
          { key: legendTitle, value: value.toFixed(3) },
        ],
        visible: true,
        width: 160,
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

  $effect(() => {
    const _ = [
      matrix,
      labels,
      width,
      height,
      colorScale,
      colorValueRange,
      dpiOverride,
      legendTitle,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    ]

    untrack(() => {
      plot.refresh()
    })
  })
</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={plot.actionOptions}
  use:canvasBlockSelect={{ regions: blockedRegions }}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
></canvas>
