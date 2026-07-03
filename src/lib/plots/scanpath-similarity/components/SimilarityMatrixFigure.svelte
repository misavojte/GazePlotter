<script lang="ts">
  import { getColorForValue } from '$lib/color'
  import {
    METRIC_MISSING_MESSAGE,
    cannotFitPlaceholder,
  } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { SIMILARITY_MATRIX_LAYOUT } from '../const'
  import { computeSimilarityMatrixLayout } from '../core/layout'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
    drawPlotArea,
    usePlot,
    NO_MARGINS,
    renderMatrixContent,
    drawMatrixCrosshair,
    matrixCellAt,
    canvasBlockSelect,
    MATRIX_LEGEND_GAP,
    MIN_LEGIBLE_CELL_SIZE,
    type BlockedRegion,
    type CanvasExportProps,
    type FrameHit,
    type MatrixRenderConfig,
    type PlotFrame,
  } from '$lib/plots/shared'

  interface Props extends CanvasExportProps {
    matrix: Float64Array
    labels: string[]
    colorScale?: string[]
    colorValueRange: [number, number]
    legendTitle?: string
    /** Bare quantity name for the per-cell tooltip key (no plot-level qualifiers). */
    valueLabel?: string
    noMetric?: boolean
  }

  let {
    matrix = new Float64Array(0),
    labels = [],
    height = 500,
    width = 500,
    colorScale = ['#f7fbff', '#08306b'],
    colorValueRange = [0, 1],
    legendTitle = 'Similarity',
    valueLabel = 'Similarity',
    noMetric = false,
    dpiOverride = null,
    margins = NO_MARGINS,
  }: Props = $props()

  function drawHoverCrosshair(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const hoveredCell = plot.hover.data
    if (hoveredCell) drawMatrixCrosshair(ctx, layout, hoveredCell)
  }

  const plot = usePlot<{ row: number; col: number }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [matrix, labels, colorScale, colorValueRange, legendTitle, noMetric],
    // noMetric (resolution failed) takes priority over empty data, since the
    // user's first action is fixing the metric, not the data.
    placeholder: () =>
      noMetric
        ? METRIC_MISSING_MESSAGE
        : labels.length === 0
          ? 'No participant data available'
          : null,
    fit: () =>
      layout.cellSize >= MIN_LEGIBLE_CELL_SIZE
        ? null
        : cannotFitPlaceholder('size', [
            'Reduce the number of participants in Plot Settings > Participant group',
          ]),
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
    drawOverlay: drawHoverCrosshair,
    blockedRegions: () => blockedRegions,
  })

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
      // width/height are the TOTAL canvas; computeSquareMatrixLayout carves the
      // margins (offset + plot-area) out of it.
      width,
      height,
      labels,
      effectiveMaxValue,
      margins,
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
    formatCellValue: (v: number) => v.toFixed(2),
    getCellColor: getColor,
  })

  const legendGeometry = $derived.by(() => {
    const { gridWidth, xOffset, matrixBottom } = layout
    const availableLegendSpace = height - matrixBottom - MATRIX_LEGEND_GAP - margins.bottom

    return computeGradientLegendGeometry({
      x: xOffset,
      y: matrixBottom + MATRIX_LEGEND_GAP,
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

  function computeHit(mx: number, my: number): FrameHit<{ row: number; col: number }> | null {
    const cell = matrixCellAt(layout, mx, my, labels.length)
    if (!cell) return null
    const { row, col } = cell
    const { xOffset, yOffset, cellSize } = layout

    const value = matrix[row * labels.length + col] ?? 0
    return {
      tooltipId: 'similarity-matrix-tooltip',
      content: [
        { key: 'Row', value: labels[row] },
        { key: 'Column', value: labels[col] },
        { key: valueLabel, value: value.toFixed(3) },
      ],
      anchorX: xOffset + col * cellSize + cellSize,
      anchorY: yOffset + row * cellSize + cellSize,
      offset: { x: 10, y: 10 },
      tooltipWidth: 160,
      cursor: 'crosshair',
      data: cell,
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
></canvas>
