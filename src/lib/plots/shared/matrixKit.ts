/**
 * The kit for every square-matrix plot (transition matrix, similarity matrix,
 * correlation heatmap, SPLOM, metric matrix). Per-plot semantics arrive as
 * data: the color mapping is declarative (scale + range + out-of-range colors)
 * so screen recipes can override `colorValueRange` in the input; only the
 * genuinely plot-specific pieces (value formatting, tooltip rows, custom cell
 * content) are functions, built in `deriveView` from plain data.
 *
 * The matrix lays itself out from the canvas size (`computeMatrixLayout`) and
 * draws its labels outside the cell grid, so its frame is scaffold-only.
 */
import { getColorForValue } from '$lib/color'
import { cursorRows, type CursorRead } from './cursorMarks'
import {
  cannotFitPlaceholder,
  type PlotPlaceholderContent,
} from './drawCanvasPlaceholder'
import { defineKit } from './kit'
import {
  computeGradientLegendGeometry,
  drawGradientLegend,
  gradientCapHit,
} from './legendGradient'
import {
  MATRIX_LAYOUT,
  MATRIX_LEGEND_GAP,
  MIN_LEGIBLE_CELL_SIZE,
  computeMatrixLayout,
  type MatrixLayout,
} from './matrixLayout'
import {
  drawMatrixCrosshair,
  drawMatrixParticipantStrips,
  matrixCellAt,
  matrixCellParticipants,
  matrixLabelAt,
  renderMatrixContent,
  type MatrixRenderConfig,
} from './matrixRenderer'
import { drawPlotArea } from './plotArea'
import { highlightTooltip } from './legendRendering'

export interface MatrixInput {
  /** Flat row-major values (rowCount × colCount); non-finite marks an undefined cell. */
  matrix: ArrayLike<number>
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
  rowParticipantIds?: readonly number[]
  colParticipantIds?: readonly number[]
  /**
   * A square matrix's highlight identifier per label. Set, the axis labels
   * toggle `highlights` like legend items, and cells whose row and column are
   * both un-highlighted turn a flat grey, keeping their values.
   */
  labelIds?: readonly string[]
  highlights?: readonly string[]
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
  placeholder?: PlotPlaceholderContent | null
  /** Fix-it steps for the too-small fit guard. */
  fitSteps?: string[]
  minLegibleCellSize?: number
  tooltipWidth?: number
  getCellTooltip: (row: number, col: number) => Array<{ key: string; value: string }>
  /** Replaces the heat-cell fill pass; grid, labels and hover stay shared. */
  drawCells?: (ctx: CanvasRenderingContext2D, layout: MatrixLayout) => void
  /** `drawCells`' overlay twin: the PLOT CURSOR's participant INSIDE the cells
   *  (a SPLOM dot). Opt-in, like the id arrays. */
  drawCellsCursor?: (
    ctx: CanvasRenderingContext2D,
    layout: MatrixLayout,
    participants: readonly number[]
  ) => void
}

type Cell = { row: number; col: number }
type Hover = Cell | { label: number }

const defaultFormat = (v: number) => v.toFixed(2)

/** The cursor's participants as this matrix's row and column positions. */
function cursorStrips(input: MatrixInput, cursor: CursorRead) {
  return {
    rows: cursorRows(input.rowParticipantIds ?? [], cursor.participants),
    cols: cursorRows(input.colParticipantIds ?? [], cursor.participants),
  }
}

export const matrixKit = defineKit<MatrixInput, Hover>()({
  label: 'Matrix visualization',
  clip: false,

  chrome: input => ({ placeholder: input.placeholder ?? null }),

  scene: (input, { size }) => {
    const rows = input.rowLabels ?? input.labels ?? []
    const cols = input.colLabels ?? input.labels ?? []
    const matrix = input.matrix
    const colorScale = input.colorScale ?? []
    const [min, rangeMax] = input.colorValueRange ?? [0, 0]
    const format = input.formatCellValue ?? defaultFormat

    let max = rangeMax
    if (max === 0) {
      for (let i = 0; i < matrix.length; i++) if (matrix[i] > max) max = matrix[i]
      const scale = 10 ** (input.autoMaxDecimals ?? 2)
      max = Math.ceil(max * scale) / scale
    }

    const layout = computeMatrixLayout({
      // width/height are the TOTAL canvas; the layout carves the margin out of it.
      width: size.width,
      height: size.height,
      rowLabels: rows,
      colLabels: cols,
      xAxisTitle: input.xAxisTitle,
      yAxisTitle: input.yAxisTitle,
      cellValueLabels: [format(min), format(max)],
      layoutConfig: MATRIX_LAYOUT,
      margin: size.margin,
    })

    const below = input.belowMinColor
    const above = rangeMax !== 0 ? input.aboveMaxColor : undefined
    const nonFinite = input.nonFiniteColor ?? colorScale[0]
    const showBelow = input.showBelowMinLabels ?? false
    const showAbove = input.showAboveMaxLabels ?? false
    const isBelow = (v: number) => below !== undefined && v < min
    const isAbove = (v: number) => above !== undefined && v > max
    // Whether each label is highlighted; none drawn here means nothing fades.
    const highlights = input.highlights ?? []
    const lit = input.labelIds?.map(id => highlights.includes(id)) ?? []
    const fade = lit.includes(true)
    const render: MatrixRenderConfig = {
      layout,
      rowLabels: rows,
      colLabels: cols,
      matrix,
      maxLabelLength: MATRIX_LAYOUT.maxLabelLength,
      formatCellValue: v => (Number.isFinite(v) ? format(v) : '—'),
      getCellColor: v => {
        if (!Number.isFinite(v)) return nonFinite
        if (isBelow(v)) return below as string
        if (isAbove(v)) return above as string
        return getColorForValue(v, min, max, colorScale)
      },
      showCellValue: v => {
        if (!Number.isFinite(v)) return false
        if (isBelow(v)) return showBelow
        if (isAbove(v)) return showAbove
        return true
      },
      dimCell: fade ? (row, col) => !lit[row] && !lit[col] : undefined,
      hasLastRowSentinel: input.hasLastRowSentinel ?? false,
      drawCells: input.drawCells,
    }

    const legendTitle = input.legendTitle ?? null
    const fixedWidth = input.legendFixedWidth ?? false
    const legend =
      legendTitle === null
        ? null
        : computeGradientLegendGeometry({
            x: fixedWidth ? size.margin : layout.xOffset,
            y: layout.matrixBottom + MATRIX_LEGEND_GAP,
            availableWidth: fixedWidth ? size.width - size.margin * 2 : layout.gridWidth,
            availableHeight: size.height - layout.matrixBottom - MATRIX_LEGEND_GAP - size.margin,
            colorScale,
            belowMinColor: input.belowMinColor,
            aboveMaxColor: input.aboveMaxColor,
            valueRange: [min, rangeMax],
            effectiveMaxValue: max,
            title: legendTitle,
            fixedWidth,
          })

    return { input, layout, render, legend, lit, rowCount: rows.length, colCount: cols.length }
  },

  fit: scene =>
    scene.layout.cellSize >= (scene.input.minLegibleCellSize ?? MIN_LEGIBLE_CELL_SIZE)
      ? null
      : cannotFitPlaceholder('size', scene.input.fitSteps ?? []),

  draw: (ctx, scene) => {
    const { layout } = scene
    renderMatrixContent(ctx, scene.render)
    drawPlotArea(ctx, {
      x: layout.xOffset,
      y: layout.yOffset,
      width: layout.gridWidth,
      height: layout.gridHeight,
    })
    if (scene.legend) drawGradientLegend(ctx, scene.legend)
  },

  overlay: {
    // The ids part is gated on an in-cell painter (a SPLOM has no participant
    // AXIS), so a plain matrix never repaints for ids it cannot render.
    key: (scene, cursor) => {
      const strips = cursorStrips(scene.input, cursor)
      const ids = scene.input.drawCellsCursor ? cursor.participants.join(',') : ''
      return `${strips.rows.join(',')}|${strips.cols.join(',')}|${ids}`
    },
    draw: (ctx, scene, _frame, { hover, cursor }) => {
      // The remote participants first: independent of this plot's own hover, and
      // outlines rather than bands so the two never read as the same thing.
      drawMatrixParticipantStrips(ctx, scene.layout, cursorStrips(scene.input, cursor))
      if (cursor.participants.length > 0) {
        scene.input.drawCellsCursor?.(ctx, scene.layout, cursor.participants)
      }
      if (hover && 'row' in hover) drawMatrixCrosshair(ctx, scene.layout, hover)
    },
  },

  hit: (scene, mx, my) => {
    const cap = gradientCapHit(scene.legend, mx, my)
    if (cap) return cap
    const { layout } = scene
    const label = scene.input.labelIds && matrixLabelAt(layout, mx, my, scene.rowCount, scene.colCount)
    if (label) {
      const { index } = label
      const isRow = label.axis === 'row'
      return {
        content: highlightTooltip(scene.render.rowLabels[index], scene.lit[index]),
        anchorX: isRow ? layout.xOffset - layout.individualLabelMargin : layout.xOffset + (index + 0.5) * layout.cellSize,
        anchorY: isRow ? layout.yOffset + (index + 1) * layout.cellSize : layout.yOffset - layout.individualLabelMargin,
        offset: { x: 0, y: 7 },
        cursor: 'pointer',
        data: { label: index },
      }
    }
    const cell = matrixCellAt(layout, mx, my, scene.rowCount, scene.colCount)
    if (!cell) return null
    return {
      content: scene.input.getCellTooltip(cell.row, cell.col),
      anchorX: layout.xOffset + cell.col * layout.cellSize + layout.cellSize,
      anchorY: layout.yOffset + cell.row * layout.cellSize + layout.cellSize,
      offset: { x: 10, y: 10 },
      tooltipWidth: scene.input.tooltipWidth ?? 160,
      cursor: 'crosshair',
      data: cell,
    }
  },

  // A cell designates whoever its axes carry: one participant on a participant
  // x stimulus matrix, a PAIR on a participant x participant one. The other axis
  // (a stimulus, an AOI, a metric) is in no channel. Read live, so a data change
  // under a resting pointer re-derives who they are; nothing means retract.
  hover: (hover, act) => {
    const cell = hover && 'row' in hover ? hover : null
    const participantsAt = (c: Cell) => {
      const input = act.scene()?.input
      return input
        ? matrixCellParticipants(input.rowParticipantIds, input.colParticipantIds, c)
        : []
    }
    act.publish(
      cell === null || participantsAt(cell).length === 0
        ? null
        : { participants: () => participantsAt(cell) }
    )
  },

  click: (hover, act) => {
    const ids = act.input().labelIds
    if (hover && 'label' in hover && ids) act.toggle('highlights', ids[hover.label])
  },

  // The matrix body is blocked, and so are clickable axis labels; the legend
  // below is static chrome (no clickable cells), so it stays selectable.
  blockedRegions: ({ input, layout, rowCount, colCount }) => {
    if (rowCount === 0 || colCount === 0) return []
    const { xOffset: x, yOffset: y, gridWidth: w, gridHeight: h } = layout
    const body = { x, y, w, h }
    if (!input.labelIds || !layout.showAxisLabels) return [body]
    const rowBand = layout.individualLabelMargin + layout.yAxisLabelWidth
    const colBand = layout.individualLabelMargin + layout.xAxisLabelHeight
    return [
      body,
      { x: x - rowBand, y, w: rowBand, h },
      { x, y: y - colBand, w: w + colBand, h: colBand },
    ]
  },
})
