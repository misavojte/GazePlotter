<script lang="ts">
  import { getColorForValue } from '$lib/color'
  import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    TRANSITION_MATRIX_LAYOUT,
    TRANSITION_MATRIX_DEFAULTS,
  } from '../const'
  import { computeTransitionMatrixLayout } from '../core/layout'
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
    TransitionMatrix: Float64Array | number[]
    aoiLabels: string[]
    colorScale?: string[]
    xLabel?: string
    yLabel?: string
    legendTitle?: string
    colorValueRange: [number, number]
    belowMinColor?: string
    aboveMaxColor?: string
    showBelowMinLabels?: boolean
    showAboveMaxLabels?: boolean
    noMetric?: boolean
  }

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
    margins = NO_MARGINS,
    noMetric = false,
  }: Props = $props()

  const effectiveMaxValue = $derived.by(() => {
    if (colorValueRange[1] !== 0) return colorValueRange[1]
    let maxValue = 0
    for (let i = 0; i < TransitionMatrix.length; i++) {
      if (TransitionMatrix[i] > maxValue) maxValue = TransitionMatrix[i]
    }
    return Math.ceil(maxValue)
  })

  const layout = $derived.by(() =>
    computeTransitionMatrixLayout({ width, height, margins, aoiLabels, effectiveMaxValue })
  )

  const plot = usePlot({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [
      TransitionMatrix, aoiLabels, colorScale, xLabel, yLabel, legendTitle,
      colorValueRange, belowMinColor, aboveMaxColor, showBelowMinLabels, showAboveMaxLabels,
    ],
    placeholder: () =>
      noMetric ? METRIC_MISSING_MESSAGE : aoiLabels.length === 0 ? 'No AOI data available' : null,
    // The matrix owns its own layout (computeTransitionMatrixLayout) and draws
    // its labels outside the cell grid, so the frame is scaffold-only here.
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

  // The matrix body is the only blocked region; its gradient legend is static.
  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    if (noMetric || aoiLabels.length === 0) return []
    return [{ x: layout.xOffset, y: layout.yOffset, w: layout.gridWidth, h: layout.gridHeight }]
  })

  const isBelowMinimum = (v: number) => v < colorValueRange[0]
  const isAboveMaximum = (v: number) => v > effectiveMaxValue && colorValueRange[1] !== 0

  function getCellColor(value: number): string {
    // Non-finite marks an undefined cell (e.g. transitionProbability with no
    // outgoing transitions) — render out-of-bounds, distinct from a real zero.
    if (!Number.isFinite(value)) return belowMinColor
    if (isBelowMinimum(value)) return belowMinColor
    if (isAboveMaximum(value)) return aboveMaxColor
    return getColorForValue(value, colorValueRange[0], effectiveMaxValue, colorScale)
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
    formatCellValue: (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(1)),
    getCellColor,
    showCellValue: (v: number) =>
      Number.isFinite(v) &&
      ((!isBelowMinimum(v) && !isAboveMaximum(v)) ||
        (isBelowMinimum(v) && showBelowMinLabels) ||
        (isAboveMaximum(v) && showAboveMaxLabels)),
    hasLastRowSentinel: true,
  })

  const legendGeometry = $derived.by(() => {
    const { gridWidth, xOffset, matrixBottom } = layout
    return computeGradientLegendGeometry({
      x: xOffset,
      y: matrixBottom + MATRIX_LEGEND_GAP,
      availableWidth: gridWidth,
      availableHeight: height - matrixBottom - MATRIX_LEGEND_GAP - margins.bottom,
      colorScale,
      valueRange: colorValueRange,
      effectiveMaxValue,
      title: legendTitle,
    })
  })

  function drawLegend(ctx: CanvasRenderingContext2D) {
    if (!legendGeometry) return
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

  function computeHit(mx: number, my: number): FrameHit | null {
    const { xOffset, yOffset, cellSize } = layout
    const col = Math.floor((mx - xOffset) / cellSize)
    const row = Math.floor((my - yOffset) / cellSize)
    const size = aoiLabels.length
    if (row < 0 || row >= size || col < 0 || col >= size) return null

    const value = TransitionMatrix[row * size + col] ?? 0
    return {
      tooltipId: 'transition-matrix-tooltip',
      content: [
        { key: 'From', value: aoiLabels[row] },
        { key: 'To', value: aoiLabels[col] },
        { key: 'Value', value: Number.isFinite(value) ? value.toString() : '—' },
      ],
      anchorX: xOffset + col * cellSize + cellSize,
      anchorY: yOffset + row * cellSize + (cellSize >> 1),
      offset: { x: 10, y: 0 },
      tooltipWidth: 150,
      cursor: 'pointer',
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
></canvas>
