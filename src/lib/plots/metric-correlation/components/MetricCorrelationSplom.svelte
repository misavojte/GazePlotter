<script lang="ts">
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import {
    beginCanvasDrawing,
    finishCanvasDrawing,
  } from '$lib/plots/shared/canvasUtils'
  import { drawCanvasPlaceholder, METRIC_MISSING_MULTI_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    MATRIX_LAYOUT,
    computeSquareMatrixLayout,
    drawMatrixAxisLabels,
    drawMatrixColumnLabels,
    drawMatrixGrid,
    drawMatrixRowLabels,
    drawPlotArea,
    usePlot,
    canvasBlockSelect,
    type BlockedRegion,
    type MatrixRenderConfig,
    type SquareMatrixLayout,
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

  const plot = usePlot({
    render: renderCanvas,
    width: () => width,
    height: () => height,
    margins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    dpiOverride: () => dpiOverride,
    deps: () => [result, labels, methodLabel],
    onMouseMove: handlePlotMouseMove,
  })

  const labels = $derived(result.metrics.map(m => m.label))

  const methodLabel = $derived(
    result.correlationMethod === 'spearman' ? 'ρ' : 'r'
  )

  const layout = $derived.by(() =>
    computeSquareMatrixLayout({
      // width/height are the TOTAL canvas; the layout carves margins out of it.
      width,
      height,
      labels,
      cellValueLabelLength: 5,
      layoutConfig: MATRIX_LAYOUT,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    })
  )

  // SPLOM cells are the data area; axis labels around them stay selectable.
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

  // Per-metric value ranges, used to place scatter points inside each cell.
  const ranges = $derived.by(() =>
    result.vectors.map(v => rangeOf(v.values))
  )

  function rangeOf(values: number[]): { min: number; max: number } {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (Number.isNaN(v)) continue
      if (v < min) min = v
      if (v > max) max = v
    }
    if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 }
    if (min === max) {
      const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.05 : 1
      return { min: min - pad, max: max + pad }
    }
    return { min, max }
  }

  function cellBackground(r: number | null): string {
    if (r === null) return '#fafafa'
    const clamped = Math.max(-1, Math.min(1, r))
    const alpha = Math.abs(clamped) * 0.12
    if (clamped >= 0) return `rgba(202, 0, 32, ${alpha.toFixed(3)})`
    return `rgba(33, 102, 172, ${alpha.toFixed(3)})`
  }

  function rColor(r: number): string {
    if (Math.abs(r) < 0.5) return '#555'
    return r > 0 ? '#a00015' : '#1a4a8a'
  }

  function drawCells(ctx: CanvasRenderingContext2D, lay: SquareMatrixLayout) {
    const { xOffset, yOffset, cellSize } = lay
    const n = labels.length
    const pad = Math.max(3, cellSize * 0.08)
    const innerSize = cellSize - pad * 2

    const scatterFontSize = Math.min(14, Math.max(9, cellSize / 5))
    const rFontSize = Math.min(20, Math.max(11, cellSize / 3.2))

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const cell = result.cells[row * n + col]
        const x = xOffset + col * cellSize
        const y = yOffset + row * cellSize

        if (row === col) {
          ctx.fillStyle = '#f0f0f0'
          ctx.fillRect(x, y, cellSize, cellSize)
          ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
          ctx.font = `500 ${scatterFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            result.metrics[row].unit || result.metrics[row].label,
            x + cellSize / 2,
            y + cellSize / 2
          )
          continue
        }

        ctx.fillStyle = cellBackground(cell.r)
        ctx.fillRect(x, y, cellSize, cellSize)

        if (row < col) {
          // Upper triangle: r value
          const label = cell.r === null ? '—' : cell.r.toFixed(2)
          ctx.font = `600 ${rFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
          ctx.fillStyle = cell.r === null ? '#999' : rColor(cell.r)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, x + cellSize / 2, y + cellSize / 2)
        } else {
          // Lower triangle: scatter
          if (!cell.points || cell.points.length === 0) continue
          const xRange = ranges[col]
          const yRange = ranges[row]
          const xDen = xRange.max - xRange.min || 1
          const yDen = yRange.max - yRange.min || 1
          const innerX = x + pad
          const innerY = y + pad
          const dotR = Math.max(1.2, Math.min(2.8, innerSize / 40))

          ctx.fillStyle = '#2c3e50'
          ctx.globalAlpha = 0.65
          for (const point of cell.points) {
            const px =
              innerX + ((point.x - xRange.min) / xDen) * innerSize
            const py =
              innerY + innerSize - ((point.y - yRange.min) / yDen) * innerSize
            ctx.beginPath()
            ctx.arc(px, py, dotR, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        }
      }
    }
  }

  const renderConfig = $derived<MatrixRenderConfig>({
    layout,
    labels,
    matrix: new Float64Array(0),
    maxLabelLength: MATRIX_LAYOUT.maxLabelLength,
    xAxisTitle: 'Metric',
    yAxisTitle: 'Metric',
    compactUnitText: `[${methodLabel}]`,
    standardUnitText: `[${methodLabel}]`,
    formatCellValue: () => '',
    getCellColor: () => '#fff',
    showCellValue: () => false,
  })

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)
    const ctx = plot.canvasState.context
    if (!ctx) return

    if (result.noMetric || labels.length < 2) {
      drawCanvasPlaceholder(ctx, width, height, METRIC_MISSING_MULTI_MESSAGE)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    drawCells(ctx, layout)
    drawMatrixGrid(ctx, renderConfig)
    drawMatrixAxisLabels(ctx, renderConfig)
    ctx.font = `${layout.fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    drawMatrixRowLabels(ctx, renderConfig, layout.fontSize)
    drawMatrixColumnLabels(ctx, renderConfig, layout.fontSize)

    drawPlotArea(ctx, {
      x: layout.xOffset,
      y: layout.yOffset,
      width: layout.gridWidth,
      height: layout.gridHeight,
    })

    finishCanvasDrawing(plot.canvasState)
  }

  // Coordinates arrive already scaled from usePlot; null marks mouse-leave.
  function handlePlotMouseMove(
    mouseX: number | null,
    mouseY: number | null,
    _isOver: boolean
  ) {
    if (mouseX === null || mouseY === null) {
      plot.hideTooltip(0)
      if (canvas) canvas.style.cursor = 'default'
      return
    }

    const { xOffset, yOffset, cellSize } = layout
    const col = Math.floor((mouseX - xOffset) / cellSize)
    const row = Math.floor((mouseY - yOffset) / cellSize)
    const size = labels.length
    const isOverCell = row >= 0 && row < size && col >= 0 && col < size

    if (isOverCell) {
      const cell = result.cells[row * size + col]
      const x = xOffset + col * cellSize
      const y = yOffset + row * cellSize
      plot.showTooltip(
        'metric-correlation-tooltip',
        [
          { key: 'Row', value: result.metrics[row].label },
          { key: 'Col', value: result.metrics[col].label },
          { key: methodLabel, value: cell.r === null ? '—' : cell.r.toFixed(4) },
          { key: 'n', value: String(cell.n) },
        ],
        x + cellSize,
        y + (cellSize >> 1),
        { x: 10, y: 0 },
        220
      )
    } else {
      plot.hideTooltip(0)
    }

    if (canvas) {
      canvas.style.cursor = isOverCell ? 'pointer' : 'default'
    }
  }
</script>

<canvas
  bind:this={canvas}
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
></canvas>
