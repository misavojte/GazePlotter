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
    drawMatrixParticipantStrips,
    matrixCellAt,
    matrixCellParticipants,
    type MatrixRenderConfig,
  } from '../matrixRenderer'
  import {
    cursorRows,
    type PlotCursorPort,
  } from '../plotCursor.svelte'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
  } from '../legendGradient'
  import { drawPlotArea } from '../plotArea'
  import {
    usePlot,
    type FrameHit,
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
    /**
     * Participant id per row / column, when that axis IS participants. Opt-in:
     * a matrix whose axes are AOIs or metrics passes neither and takes no part in
     * the PLOT CURSOR's participant channel.
     */
    rowParticipantIds?: number[]
    colParticipantIds?: number[]
    /** Shared PLOT CURSOR (screen-only; export renders without one). */
    plotCursor?: PlotCursorPort | null
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
    tooltipWidth?: number
    getCellTooltip: (
      row: number,
      col: number
    ) => Array<{ key: string; value: string }>
    /** Replaces the heat-cell fill pass; grid, labels and hover stay shared. */
    drawCells?: (ctx: CanvasRenderingContext2D, layout: MatrixLayout) => void
    /** `drawCells`' overlay twin: the PLOT CURSOR's participant INSIDE the cells
     *  (a SPLOM dot). Opt-in, like the id arrays, and never a `deps` entry. */
    drawCellsCursor?: (
      ctx: CanvasRenderingContext2D,
      layout: MatrixLayout,
      participants: readonly number[]
    ) => void
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
    tooltipWidth = 160,
    getCellTooltip,
    drawCells,
    drawCellsCursor,
    rowParticipantIds,
    colParticipantIds,
    plotCursor = null,
    width,
    height,
    margin = 0,
  }: Props = $props()

  // `labels` is the square shorthand; a rectangular consumer (metric matrix) sets
  // the two axes independently. Everything downstream reads rows/cols.
  const rows = $derived(rowLabels ?? labels)
  const cols = $derived(colLabels ?? labels)

  // PLOT CURSOR, participants channel only — a matrix has no time axis. An axis
  // that is not participants passes no ids and stays empty.
  const cursorStrips = $derived.by(() => {
    const ids = plotCursor?.participants ?? []
    return {
      rows: cursorRows(rowParticipantIds ?? [], ids),
      cols: cursorRows(colParticipantIds ?? [], ids),
    }
  })
  // Equality-stable keys: `overlayDeps` must read ONLY these, never the cursor
  // itself, or the repaint effect re-subscribes to every pointer frame. The ids
  // key is separate because a SPLOM has no participant AXIS — its ring moves while
  // both strip sets stay empty — and gated on that seam, so a matrix with no
  // in-cell painter never repaints for ids it cannot render.
  const cursorStripsKey = $derived(
    `${cursorStrips.rows.join(',')}|${cursorStrips.cols.join(',')}`
  )
  const cursorIdsKey = $derived(
    drawCellsCursor ? (plotCursor?.participants ?? []).join(',') : ''
  )

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
      xAxisTitle,
      yAxisTitle,
      cellValueLabelLength:
        formatCellValue(effectiveMaxValue).length +
        (colorValueRange[0] < 0 ? 1 : 0),
      layoutConfig: MATRIX_LAYOUT,
      margin,
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
    const spanWidth = width - margin * 2
    return computeGradientLegendGeometry({
      x: legendFixedWidth ? margin : layout.xOffset,
      y: layout.matrixBottom + MATRIX_LEGEND_GAP,
      availableWidth: legendFixedWidth ? spanWidth : layout.gridWidth,
      availableHeight:
        height - layout.matrixBottom - MATRIX_LEGEND_GAP - margin,
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

  function drawHoverCrosshair(ctx: CanvasRenderingContext2D) {
    // The remote participants first: independent of this plot's own hover, and
    // outlines rather than bands so the two never read as the same thing.
    drawMatrixParticipantStrips(ctx, layout, cursorStrips)
    const ids = plotCursor?.participants ?? []
    if (ids.length > 0) drawCellsCursor?.(ctx, layout, ids)
    const hoveredCell = plot.hover.data
    if (hoveredCell) drawMatrixCrosshair(ctx, layout, hoveredCell)
  }

  const plot = usePlot<{ row: number; col: number }>({
    width: () => width,
    height: () => height,
    margin: () => margin,
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
    // A cell designates whoever its axes carry: one participant on a
    // participant x stimulus matrix, a PAIR on a participant x participant one.
    // The other axis (a stimulus, an AOI, a metric) is in no channel. Published as
    // a live read of the hovered INDICES, so a data change under a resting pointer
    // re-derives who they are. Nothing to publish means retract, not an empty record.
    onHover: cell =>
      plotCursor?.publish(
        cell === null || participantsAt(cell).length === 0
          ? null
          : { participants: () => participantsAt(cell) }
      ),
    overlayDeps: (): string => `${cursorStripsKey}|${cursorIdsKey}`,
    blockedRegions: () => blockedRegions,
  })

  const participantsAt = (cell: { row: number; col: number }) =>
    matrixCellParticipants(rowParticipantIds, colParticipantIds, cell)

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
