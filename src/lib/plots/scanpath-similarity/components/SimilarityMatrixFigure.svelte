<script lang="ts">
  import { getColorForValue } from '$lib/color'
  import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { SIMILARITY_MATRIX_LAYOUT } from '../const'
  import { computeSimilarityMatrixLayout } from '../core/layout'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
    drawPlotArea,
    usePlot,
    NO_MARGINS,
    renderMatrixContent,
    canvasBlockSelect,
    MATRIX_LEGEND_GAP,
    type BlockedRegion,
    type CanvasExportProps,
    type FrameHit,
    type MatrixRenderConfig,
  } from '$lib/plots/shared'

  interface Props extends CanvasExportProps {
    matrix: Float64Array
    labels: string[]
    colorScale?: string[]
    colorValueRange: [number, number]
    legendTitle?: string
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
    noMetric = false,
    dpiOverride = null,
    margins = NO_MARGINS,
  }: Props = $props()

  const plot = usePlot({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [matrix, labels, colorScale, colorValueRange, legendTitle],
    // noMetric (resolution failed) takes priority over empty data, since the
    // user's first action is fixing the metric, not the data.
    placeholder: () =>
      noMetric
        ? METRIC_MISSING_MESSAGE
        : labels.length === 0
          ? 'No participant data available'
          : null,
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
    compactUnitText: '[indices]',
    standardUnitText: '[names]',
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

  function computeHit(mx: number, my: number): FrameHit | null {
    const { xOffset, yOffset, cellSize } = layout
    const col = Math.floor((mx - xOffset) / cellSize)
    const row = Math.floor((my - yOffset) / cellSize)
    const size = labels.length
    if (row < 0 || row >= size || col < 0 || col >= size) return null

    const value = matrix[row * size + col] ?? 0
    return {
      tooltipId: 'similarity-matrix-tooltip',
      content: [
        { key: 'Row', value: labels[row] },
        { key: 'Column', value: labels[col] },
        { key: legendTitle, value: value.toFixed(3) },
      ],
      anchorX: xOffset + col * cellSize + cellSize,
      anchorY: yOffset + row * cellSize + (cellSize >> 1),
      offset: { x: 10, y: 0 },
      tooltipWidth: 160,
      cursor: 'pointer',
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
></canvas>
