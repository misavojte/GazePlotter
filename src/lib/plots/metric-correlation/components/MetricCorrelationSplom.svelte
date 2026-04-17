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
    drawMatrixAxisLabels,
    drawMatrixColumnLabels,
    drawMatrixGrid,
    drawMatrixRowLabels,
    drawPlotArea,
    useCanvasPlot,
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

  const plot = useCanvasPlot({
    render: renderCanvas,
    getWidth: () => width,
    getHeight: () => height,
    getMargins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    getDpiOverride: () => dpiOverride,
  })

  $effect(() => plot.registerExportSource(() => canvas))

  const labels = $derived(result.metrics.map(m => m.label))

  const methodLabel = $derived(
    result.correlationMethod === 'spearman' ? 'ρ' : 'r'
  )

  const scopeLabel = $derived(result.scope.label)

  const layout = $derived.by(() =>
    computeSquareMatrixLayout({
      width: width + marginLeft + marginRight,
      height: height + marginTop + marginBottom,
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
  const blockedRegions = $derived<BlockedRegion[]>([
    {
      x: layout.xOffset,
      y: layout.yOffset,
      w: layout.gridWidth,
      h: layout.gridHeight,
    },
  ])

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
    standardUnitText: `[${methodLabel} · ${scopeLabel}]`,
    formatCellValue: () => '',
    getCellColor: () => '#fff',
    showCellValue: () => false,
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
        width: 220,
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
      result,
      labels,
      scopeLabel,
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
