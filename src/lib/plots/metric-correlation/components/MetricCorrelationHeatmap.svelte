<script lang="ts">
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
  import {
    MATRIX_LAYOUT,
    computeSquareMatrixLayout,
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
  import type { MetricCorrelationResult } from '../types'

  interface Props {
    width: number
    height: number
    result: MetricCorrelationResult
    dpiOverride?: number | null
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
  }

  let {
    width,
    height,
    result,
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  }: Props = $props()

  let canvas = $state<HTMLCanvasElement | null>(null)

  const plot = useCanvasPlot({
    render: renderCanvas,
    getWidth: () => width,
    getHeight: () => height,
    getMargins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    getDpiOverride: () => dpiOverride,
  })

  $effect(() => plot.registerExportSource(() => canvas))

  const labels = $derived(result.metrics.map(m => m.label))

  // Flat row-major matrix of r values. NaN marks "undefined" (null r) so the
  // shared renderer's numeric path handles both uniformly; formatters below
  // special-case NaN to '—' and a neutral gray.
  const flatMatrix = $derived.by(() => {
    const n = result.metrics.length
    const out = new Float64Array(n * n)
    for (let i = 0; i < result.cells.length; i++) {
      const c = result.cells[i]
      out[i] = c.r === null ? Number.NaN : c.r
    }
    return out
  })

  const methodLabel = $derived(
    result.correlationMethod === 'spearman' ? 'ρ' : 'r'
  )

  const layout = $derived.by(() =>
    computeSquareMatrixLayout({
      width: width + marginLeft + marginRight,
      height: height + marginTop + marginBottom,
      labels,
      // Longest value string is like "-1.00" (5 chars) or "—" when null
      cellValueLabelLength: 5,
      layoutConfig: MATRIX_LAYOUT,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    })
  )

  // Matrix body is the only blocked region; the gradient legend is
  // static so it stays selectable chrome.
  const blockedRegions = $derived<BlockedRegion[]>([
    {
      x: layout.xOffset,
      y: layout.yOffset,
      w: layout.gridWidth,
      h: layout.gridHeight,
    },
  ])

  function cellColor(value: number): string {
    if (Number.isNaN(value)) return '#f2f2f2'
    const clamped = Math.max(-1, Math.min(1, value))
    if (clamped >= 0) {
      const t = clamped
      const rC = Math.round(255 - (255 - 202) * t)
      const gC = Math.round(255 - (255 - 0) * t)
      const bC = Math.round(255 - (255 - 32) * t)
      return `rgb(${rC}, ${gC}, ${bC})`
    }
    const t = -clamped
    const rC = Math.round(255 - (255 - 33) * t)
    const gC = Math.round(255 - (255 - 102) * t)
    const bC = Math.round(255 - (255 - 172) * t)
    return `rgb(${rC}, ${gC}, ${bC})`
  }

  function formatCellValue(value: number): string {
    if (Number.isNaN(value)) return '—'
    return value.toFixed(2)
  }

  function showCellValue(value: number): boolean {
    return !Number.isNaN(value)
  }

  const renderConfig = $derived<MatrixRenderConfig>({
    layout,
    labels,
    matrix: flatMatrix,
    maxLabelLength: MATRIX_LAYOUT.maxLabelLength,
    xAxisTitle: 'Metric',
    yAxisTitle: 'Metric',
    compactUnitText: `[${methodLabel}]`,
    standardUnitText: `[${methodLabel}]`,
    formatCellValue,
    getCellColor: cellColor,
    showCellValue,
  })

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)
    const ctx = plot.canvasState.context
    if (!ctx) return

    const totalW = width + marginLeft + marginRight
    const totalH = height + marginTop + marginBottom

    if (labels.length === 0) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Select at least two metrics to view correlations', totalW >> 1, totalH >> 1)
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
    const totalH = height + marginTop + marginBottom
    const availableLegendSpace = totalH - matrixBottom - 10

    return computeGradientLegendGeometry({
      x: xOffset,
      y: matrixBottom + 5,
      availableWidth: gridWidth,
      availableHeight: availableLegendSpace,
      colorScale: ['#2166ac', '#ffffff', '#ca0020'],
      valueRange: [-1, 1],
      effectiveMaxValue: 1,
      title: `${result.correlationMethod === 'spearman' ? 'Spearman' : 'Pearson'} correlation — N = ${result.sampleSize}`,
    })
  })

  function drawLegend(ctx: CanvasRenderingContext2D) {
    if (legendGeometry) {
      drawGradientLegend(ctx, legendGeometry, {
        x: 0,
        y: 0,
        availableWidth: 0,
        availableHeight: 0,
        colorScale: ['#2166ac', '#ffffff', '#ca0020'],
        valueRange: [-1, 1],
        effectiveMaxValue: 1,
        title: `${result.correlationMethod === 'spearman' ? 'Spearman' : 'Pearson'} correlation — N = ${result.sampleSize}`,
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
    const isOverCell = row >= 0 && row < size && col >= 0 && col < size

    if (isOverCell) {
      const cell = result.cells[row * size + col]
      const x = xOffset + col * cellSize
      const y = yOffset + row * cellSize
      const tooltipPos = getTooltipPosition(
        plot.canvasState,
        x + cellSize,
        y + (cellSize >> 1),
        { x: 10, y: 0 }
      )
      updateTooltip({
        id: 'metric-correlation-tooltip',
        x: tooltipPos.x,
        y: tooltipPos.y,
        content: [
          { key: 'Row', value: result.metrics[row].label },
          { key: 'Col', value: result.metrics[col].label },
          { key: methodLabel, value: cell.r === null ? '—' : cell.r.toFixed(4) },
          { key: 'n', value: String(cell.n) },
        ],
        visible: true,
        width: 200,
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
      flatMatrix,
      labels,
      width,
      height,
      methodLabel,
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
></canvas>
