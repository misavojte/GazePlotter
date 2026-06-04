<script lang="ts">
  import { METRIC_MISSING_MULTI_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    MATRIX_LAYOUT,
    computeSquareMatrixLayout,
    computeGradientLegendGeometry,
    drawGradientLegend,
    drawPlotArea,
    useFramedPlot,
    NO_MARGINS,
    renderMatrixContent,
    canvasBlockSelect,
    MATRIX_LEGEND_GAP,
    type BlockedRegion,
    type CanvasExportProps,
    type FrameHit,
    type MatrixRenderConfig,
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

  const plot = useFramedPlot({
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
    compactUnitText: `[${methodLabel}]`,
    standardUnitText: `[${methodLabel}]`,
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

  function computeHit(mx: number, my: number): FrameHit | null {
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
      cursor: 'pointer',
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
></canvas>
