<script lang="ts">
  import { METRIC_MISSING_MULTI_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    MATRIX_LAYOUT,
    computeSquareMatrixLayout,
    computeGradientLegendGeometry,
    drawGradientLegend,
    drawPlotArea,
    usePlot,
    NO_MARGINS,
    renderMatrixContent,
    canvasBlockSelect,
    MATRIX_LEGEND_GAP,
    withQualifiers,
    timeRangeQualifier,
    type BlockedRegion,
    type CanvasExportProps,
    type FrameHit,
    type MatrixRenderConfig,
    type PlotFrame,
  } from '$lib/plots/shared'

  import type { MetricCorrelationResult } from '../types'

  interface Props extends CanvasExportProps {
    result: MetricCorrelationResult
  }

  let {
    width,
    height,
    result,
    dpiOverride = null,
    margins = NO_MARGINS,
  }: Props = $props()

  let hoveredCell = $state<{ row: number; col: number } | null>(null)

  function drawHoverCrosshair(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!hoveredCell) return
    const { xOffset, yOffset, cellSize, gridWidth, gridHeight } = layout
    const colX = xOffset + hoveredCell.col * cellSize
    const rowY = yOffset + hoveredCell.row * cellSize

    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#007acc'
    ctx.fillRect(colX, yOffset, cellSize, gridHeight)
    ctx.fillRect(xOffset, rowY, gridWidth, cellSize)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = '#007acc'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(colX, yOffset)
    ctx.lineTo(colX, yOffset + gridHeight)
    ctx.moveTo(colX + cellSize, yOffset)
    ctx.lineTo(colX + cellSize, yOffset + gridHeight)
    ctx.moveTo(xOffset, rowY)
    ctx.lineTo(xOffset + gridWidth, rowY)
    ctx.moveTo(xOffset, rowY + cellSize)
    ctx.lineTo(xOffset + gridWidth, rowY + cellSize)
    ctx.stroke()
    ctx.restore()
  }

  const plot = usePlot<{ row: number; col: number }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [flatMatrix, labels, methodLabel],
    placeholder: () =>
      result.noMetric || labels.length < 2 ? METRIC_MISSING_MULTI_MESSAGE : null,
    gutters: () => ({}),
    clipData: false,
    drawData: (ctx) => {
      renderMatrixContent(ctx, renderConfig)
      drawPlotArea(ctx, {
        x: layout.xOffset,
        y: layout.yOffset,
        width: layout.gridWidth,
        height: layout.gridHeight,
      })
      drawLegend(ctx)
    },
    hitTest: computeHit,
    onHoverChange: (hit) => {
      const cell = hit?.data ?? null
      const changed =
        (cell?.row ?? null) !== (hoveredCell?.row ?? null) ||
        (cell?.col ?? null) !== (hoveredCell?.col ?? null)
      hoveredCell = cell
      return changed
    },
    drawOverlay: drawHoverCrosshair,
    blockedRegions: () => blockedRegions,
  })

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

  // Legend N is the group's participant count, but cells with missing data rest
  // on fewer complete pairs. Surface the smallest pairwise n among shown
  // (off-diagonal, non-null) cells so the figure — and its static export —
  // doesn't claim more support than any cell actually has.
  const legendTitle = $derived.by(() => {
    const method =
      result.correlationMethod === 'spearman' ? 'Spearman' : 'Pearson'
    const baseN = result.sampleSize
    const size = result.metrics.length
    let minN = baseN
    for (let i = 0; i < result.cells.length; i++) {
      if (Math.floor(i / size) === i % size) continue // skip diagonal
      const c = result.cells[i]
      if (c.r !== null && c.n < minN) minN = c.n
    }
    return withQualifiers(
      `${method} correlation coefficient`,
      `N = ${baseN}`,
      minN < baseN ? `min pairwise n = ${minN}` : null,
      timeRangeQualifier(result.timelineStart ?? 0, result.timelineEnd ?? 0)
    )
  })

  const layout = $derived.by(() =>
    computeSquareMatrixLayout({
      // width/height are the TOTAL canvas; the layout carves margins out of it.
      width,
      height,
      labels,
      // Longest value string is like "-1.00" (5 chars) or "—" when null
      cellValueLabelLength: 5,
      layoutConfig: MATRIX_LAYOUT,
      margins,
    })
  )

  // Matrix body is the only blocked region; the gradient legend is
  // static so it stays selectable chrome.
  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    if (result.noMetric || labels.length < 2) return []
    return [
      {
        x: layout.xOffset,
        y: layout.yOffset,
        w: layout.gridWidth,
        h: layout.gridHeight,
      },
    ]
  })

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
    formatCellValue,
    getCellColor: cellColor,
    showCellValue,
  })

  const legendGeometry = $derived.by(() => {
    const { gridWidth, xOffset, matrixBottom } = layout
    const availableLegendSpace = height - matrixBottom - MATRIX_LEGEND_GAP - margins.bottom

    return computeGradientLegendGeometry({
      x: xOffset,
      y: matrixBottom + MATRIX_LEGEND_GAP,
      availableWidth: gridWidth,
      availableHeight: availableLegendSpace,
      colorScale: ['#2166ac', '#ffffff', '#ca0020'],
      valueRange: [-1, 1],
      effectiveMaxValue: 1,
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
        colorScale: ['#2166ac', '#ffffff', '#ca0020'],
        valueRange: [-1, 1],
        effectiveMaxValue: 1,
        title: legendTitle,
      })
    }
  }

  function computeHit(mx: number, my: number): FrameHit<{ row: number; col: number }> | null {
    const { xOffset, yOffset, cellSize } = layout
    const col = Math.floor((mx - xOffset) / cellSize)
    const row = Math.floor((my - yOffset) / cellSize)
    const size = labels.length
    if (row < 0 || row >= size || col < 0 || col >= size) return null

    const cell = result.cells[row * size + col]
    return {
      tooltipId: 'metric-correlation-tooltip',
      content: [
        { key: 'Row', value: result.metrics[row].label },
        { key: 'Col', value: result.metrics[col].label },
        { key: methodLabel, value: cell.r === null ? '—' : cell.r.toFixed(4) },
        { key: 'n', value: String(cell.n) },
      ],
      anchorX: xOffset + col * cellSize + cellSize,
      anchorY: yOffset + row * cellSize + (cellSize >> 1),
      offset: { x: 10, y: 0 },
      tooltipWidth: 200,
      cursor: 'crosshair',
      data: { row, col },
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
></canvas>
