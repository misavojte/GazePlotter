<script lang="ts">
  import { getColorForValue } from '$lib/color'
  import { cannotFitPlaceholder } from '../drawCanvasPlaceholder'
  import {
    MATRIX_LAYOUT,
    MATRIX_LEGEND_GAP,
    MIN_LEGIBLE_CELL_SIZE,
    computeMatrixLayout,
    type MatrixLayout,
  } from '../matrixLayout'
  import {
    renderMatrixContent,
    drawMatrixCrosshair,
    matrixCellAt,
    type MatrixRenderConfig,
  } from '../matrixRenderer'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
  } from '../legendGradient'
  import { drawPlotArea } from '../plotArea'
  import {
    usePlot,
    NO_MARGINS,
    type FrameHit,
    type PlotFrame,
  } from '../usePlot.svelte'
  import {
    canvasBlockSelect,
    type BlockedRegion,
  } from '../canvasBlockSelect.action'
  import type { CanvasExportProps } from '../types'

  /**
   * The one figure for every square-matrix plot (transition matrix, similarity
   * matrix, correlation heatmap, SPLOM). Per-plot semantics arrive as data:
   * the color mapping is declarative (scale + range + out-of-range colors) so
   * screen recipes can override `colorValueRange` without invalidating any
   * closure; only genuinely plot-specific pieces (value formatting, tooltip
   * rows, custom cell content) are function props built in `deriveView`.
   */
  interface Props extends CanvasExportProps {
    /** Flat row-major values (rowCount × colCount); non-finite marks an undefined cell. */
    matrix: Float64Array | number[]
    /** Shorthand for a square matrix: sets both `rowLabels` and `colLabels`. */
    labels?: string[]
    /** Row (y-axis) labels. Falls back to `labels` when omitted (square case). */
    rowLabels?: string[]
    /** Column (x-axis) labels. Falls back to `labels` when omitted (square case). */
    colLabels?: string[]
    xAxisTitle: string
    yAxisTitle: string
    /** Gradient stops (2 or 3 colors) for the shared value→color mapping. */
    colorScale?: string[]
    /** [min, max]; max 0 = auto (data max, ceiled to `autoMaxDecimals`). */
    colorValueRange?: [number, number]
    autoMaxDecimals?: number
    /** When set, below-range cells paint this instead of clamping to the scale. */
    belowMinColor?: string
    /** When set, cells above an explicit range max paint this instead of clamping. */
    aboveMaxColor?: string
    /** Fill for non-finite (undefined) cells. Defaults to the scale minimum. */
    nonFiniteColor?: string
    showBelowMinLabels?: boolean
    showAboveMaxLabels?: boolean
    hasLastRowSentinel?: boolean
    formatCellValue?: (value: number) => string
    /** null hides the gradient legend (custom-content matrices like the SPLOM). */
    legendTitle?: string | null
    /**
     * Size the gradient legend to one fixed length, centered under the whole
     * figure, instead of the grid width. For plots whose grid width varies with
     * the data (the metric matrix), so the legend never shrinks with the grid.
     */
    legendFixedWidth?: boolean
    /** Data-level placeholder message; null renders the matrix. */
    placeholder?: string | null
    /** Fix-it steps for the too-small fit guard. */
    fitSteps?: string[]
    minLegibleCellSize?: number
    tooltipId: string
    tooltipWidth?: number
    getCellTooltip: (
      row: number,
      col: number
    ) => Array<{ key: string; value: string }>
    /** Replaces the heat-cell fill pass; grid, labels and hover stay shared. */
    drawCells?: (ctx: CanvasRenderingContext2D, layout: MatrixLayout) => void
  }

  let {
    matrix = new Float64Array(0),
    labels = [],
    rowLabels,
    colLabels,
    xAxisTitle,
    yAxisTitle,
    colorScale = [],
    colorValueRange = [0, 0],
    autoMaxDecimals = 2,
    belowMinColor,
    aboveMaxColor,
    nonFiniteColor,
    showBelowMinLabels = false,
    showAboveMaxLabels = false,
    hasLastRowSentinel = false,
    formatCellValue = (v: number) => v.toFixed(2),
    legendTitle = null,
    legendFixedWidth = false,
    placeholder = null,
    fitSteps = [],
    minLegibleCellSize = MIN_LEGIBLE_CELL_SIZE,
    tooltipId,
    tooltipWidth = 160,
    getCellTooltip,
    drawCells,
    width,
    height,
    dpiOverride = null,
    margins = NO_MARGINS,
  }: Props = $props()

  // `labels` is the square shorthand; a rectangular consumer (metric matrix) sets
  // the two axes independently. Everything downstream reads rows/cols.
  const rows = $derived(rowLabels ?? labels)
  const cols = $derived(colLabels ?? labels)

  const effectiveMaxValue = $derived.by(() => {
    if (colorValueRange[1] !== 0) return colorValueRange[1]
    let max = 0
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i] > max) max = matrix[i]
    }
    const scale = 10 ** autoMaxDecimals
    return Math.ceil(max * scale) / scale
  })

  const layout = $derived.by(() =>
    computeMatrixLayout({
      // width/height are the TOTAL canvas; the layout carves margins out of it.
      width,
      height,
      rowLabels: rows,
      colLabels: cols,
      cellValueLabelLength:
        formatCellValue(effectiveMaxValue).length +
        (colorValueRange[0] < 0 ? 1 : 0),
      layoutConfig: MATRIX_LAYOUT,
      margins,
    })
  )

  const isBelowMinimum = (v: number) =>
    belowMinColor !== undefined && v < colorValueRange[0]
  const isAboveMaximum = (v: number) =>
    aboveMaxColor !== undefined &&
    colorValueRange[1] !== 0 &&
    v > effectiveMaxValue

  function getCellColor(value: number): string {
    if (!Number.isFinite(value)) return nonFiniteColor ?? colorScale[0]
    if (isBelowMinimum(value)) return belowMinColor as string
    if (isAboveMaximum(value)) return aboveMaxColor as string
    return getColorForValue(
      value,
      colorValueRange[0],
      effectiveMaxValue,
      colorScale
    )
  }

  function showCellValue(value: number): boolean {
    if (!Number.isFinite(value)) return false
    if (isBelowMinimum(value)) return showBelowMinLabels
    if (isAboveMaximum(value)) return showAboveMaxLabels
    return true
  }

  const renderConfig = $derived<MatrixRenderConfig>({
    layout,
    rowLabels: rows,
    colLabels: cols,
    matrix,
    maxLabelLength: MATRIX_LAYOUT.maxLabelLength,
    xAxisTitle,
    yAxisTitle,
    formatCellValue: (v: number) => (Number.isFinite(v) ? formatCellValue(v) : '—'),
    getCellColor,
    showCellValue,
    hasLastRowSentinel,
    drawCells,
  })

  const legendGeometry = $derived.by(() => {
    if (legendTitle === null) return null
    // A fixed-length legend centers under the whole figure (its grid width
    // varies); the default sizes and centers it under the grid.
    const spanWidth = width - margins.left - margins.right
    return computeGradientLegendGeometry({
      x: legendFixedWidth ? margins.left : layout.xOffset,
      y: layout.matrixBottom + MATRIX_LEGEND_GAP,
      availableWidth: legendFixedWidth ? spanWidth : layout.gridWidth,
      availableHeight:
        height - layout.matrixBottom - MATRIX_LEGEND_GAP - margins.bottom,
      colorScale,
      valueRange: colorValueRange,
      effectiveMaxValue,
      title: legendTitle,
      fixedWidth: legendFixedWidth,
    })
  })

  function drawLegend(ctx: CanvasRenderingContext2D) {
    if (legendGeometry) drawGradientLegend(ctx, legendGeometry)
  }

  function drawHoverCrosshair(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const hoveredCell = plot.hover.data
    if (hoveredCell) drawMatrixCrosshair(ctx, layout, hoveredCell)
  }

  const plot = usePlot<{ row: number; col: number }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [
      matrix,
      rows,
      cols,
      xAxisTitle,
      yAxisTitle,
      colorScale,
      colorValueRange,
      belowMinColor,
      aboveMaxColor,
      nonFiniteColor,
      showBelowMinLabels,
      showAboveMaxLabels,
      legendTitle,
      placeholder,
      formatCellValue,
      getCellTooltip,
      drawCells,
    ],
    placeholder: () => placeholder,
    fit: () =>
      layout.cellSize >= minLegibleCellSize
        ? null
        : cannotFitPlaceholder('size', fitSteps),
    // The matrix owns its own layout (computeMatrixLayout) and draws its
    // labels outside the cell grid, so the frame is scaffold-only here.
    gutters: () => ({}),
    clipData: false,
    drawData: ctx => {
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

  // The matrix body is the only blocked region; the legend below is static
  // chrome (no clickable cells), so it stays selectable.
  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    if (placeholder !== null || rows.length === 0 || cols.length === 0) return []
    return [
      {
        x: layout.xOffset,
        y: layout.yOffset,
        w: layout.gridWidth,
        h: layout.gridHeight,
      },
    ]
  })

  function computeHit(
    mx: number,
    my: number
  ): FrameHit<{ row: number; col: number }> | null {
    const cell = matrixCellAt(layout, mx, my, rows.length, cols.length)
    if (!cell) return null
    const { xOffset, yOffset, cellSize } = layout
    return {
      tooltipId,
      content: getCellTooltip(cell.row, cell.col),
      anchorX: xOffset + cell.col * cellSize + cellSize,
      anchorY: yOffset + cell.row * cellSize + cellSize,
      offset: { x: 10, y: 10 },
      tooltipWidth,
      cursor: 'crosshair',
      data: cell,
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
></canvas>
