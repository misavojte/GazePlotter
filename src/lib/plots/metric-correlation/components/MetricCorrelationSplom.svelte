<script lang="ts">
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import { METRIC_MISSING_MULTI_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    MATRIX_LAYOUT,
    computeSquareMatrixLayout,
    drawMatrixAxisLabels,
    drawMatrixColumnLabels,
    drawMatrixGrid,
    drawMatrixRowLabels,
    drawPlotArea,
    usePlot,
    NO_MARGINS,
    canvasBlockSelect,
    type BlockedRegion,
    type CanvasExportProps,
    type FrameHit,
    type MatrixRenderConfig,
    type SquareMatrixLayout,
    type PlotFrame,
  } from '$lib/plots/shared'
  import { UI_COLORS } from '$lib/color'
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
    deps: () => [result, labels, methodLabel],
    placeholder: () =>
      result.noMetric || labels.length < 2 ? METRIC_MISSING_MULTI_MESSAGE : null,
    gutters: () => ({}),
    clipData: false,
    drawData: (ctx) => {
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
      margins,
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
    formatCellValue: () => '',
    getCellColor: () => '#fff',
    showCellValue: () => false,
  })

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
      tooltipWidth: 220,
      cursor: 'crosshair',
      data: { row, col },
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
></canvas>
