import { getGradientLegendRequiredHeight } from './legendGradient'
import { axisTitleLineHeight, calculateTickStep, wrapAxisTitle } from './axisUtils'
import { FONT_PRIMARY, PLOT_AXIS_TITLE_GAP, PLOT_BORDER_PX, PLOT_TICK_LABEL_GAP } from './const'
import { estimateTextWidth, truncateTextToPixelWidth } from '$lib/shared/textMeasure'

const SIN_45 = Math.SQRT1_2

/**
 * Vertical gap between the bottom of the matrix grid and the top of the
 * gradient legend.  Exported so figure components can re-use the same
 * value when positioning the legend.
 */
export const MATRIX_LEGEND_GAP = 10

/**
 * Legibility floors for matrix cells. The layout keeps rendering down to
 * ~1px cells (ultra-compact mode), so these are NOT the layout's `minCellSize`
 * (that only switches label density). Below these the view stops being
 * interpretable and the figure paints a fit-guard placeholder instead:
 * - color grids (transition matrix, correlation heatmap, similarity matrix,
 *   metric matrix): individual cells can no longer be visually resolved nor
 *   mapped to a label.
 * - the correlation SPLOM needs extra room for a scatter + r-value per cell.
 */
export const MIN_LEGIBLE_CELL_SIZE = 8
export const MIN_LEGIBLE_SPLOM_CELL_SIZE = 12

export const MATRIX_LAYOUT = {
  minCellSize: 20,
  maxLabelLength: 85,
  COMPACT_THRESHOLD: 26,
  LABEL_FONT_SIZE: 12,
  CELL_VALUE_FONT_SIZE: 9,
} as const

export type MatrixLayoutConfig = typeof MATRIX_LAYOUT

/**
 * Input to {@link computeMatrixLayout}. `rowLabels`/`colLabels` are independent
 * axes: a square matrix (transition, correlation, similarity) passes the same
 * array for both; the metric matrix passes participants × stimuli. Cells stay
 * square — the shorter axis letterboxes.
 */
export type MatrixLayoutInput = {
  width: number
  height: number
  rowLabels: string[]
  colLabels: string[]
  /** Axis titles; the layout wraps them (≤2 lines) and reserves their height. */
  xAxisTitle: string
  yAxisTitle: string
  /** Formatted values spanning the cell text (the range ends); the widest
   *  decides whether values fit in a cell. */
  cellValueLabels: string[]
  layoutConfig: MatrixLayoutConfig
  margin?: number
}

export type MatrixLayout = {
  fontSize: number
  xAxisLabelHeight: number
  yAxisLabelWidth: number
  axisTitleGap: number
  /** Pre-wrapped axis-title lines; the reservation covers exactly these, so the
   *  renderer draws them verbatim instead of re-wrapping. */
  xTitleLines: string[]
  yTitleLines: string[]
  xOffset: number
  yOffset: number
  cellSize: number
  gridWidth: number
  gridHeight: number
  matrixBottom: number
  rowCount: number
  colCount: number
  isCompactMode: boolean
  isUltraCompactMode: boolean
  /** Label-skip stride for the row (y) axis in compact / ultra-compact mode. */
  rowThinFactor: number
  /** Label-skip stride for the column (x) axis in compact / ultra-compact mode. */
  colThinFactor: number
  individualLabelMargin: number
  showCellValues: boolean
  showAxisLabels: boolean
  cellValueFontSize: number
}

/** Width (px) of `text` in the matrix label font. */
const labelWidth = (text: string, fontSize: number) =>
  estimateTextWidth(text, fontSize, FONT_PRIMARY.FAMILY)

/** A full (non-compact) axis label truncated to its budget: the ONE rule the
 *  layout measures and the renderer draws. */
export function truncatedAxisLabel(label: string, fontSize: number, maxLabelLength: number): string {
  return truncateTextToPixelWidth(label, maxLabelLength, fontSize, FONT_PRIMARY.FAMILY, '...')
}

/** Widest label as drawn (truncated like the renderer truncates it). */
function estimateMaxLabelWidth(
  labels: string[],
  fontSize: number,
  maxLabelLength: number
): number {
  let max = 0
  for (const label of labels) {
    max = Math.max(max, labelWidth(truncatedAxisLabel(label, fontSize, maxLabelLength), fontSize))
  }
  return max
}

/**
 * Compact-mode label-skip stride for one axis: derived from the digit width of
 * the axis' index labels against the cell size (the same rule the former
 * square layout applied to a single shared count).
 */
function compactThinFactor(
  count: number,
  fontSize: number,
  cellSize: number
): number {
  const approxIndexWidth = labelWidth(count.toString(), fontSize)
  return Math.max(1, Math.ceil((approxIndexWidth + 4) / cellSize))
}

/**
 * What one label mode (full names or compact indices) occupies around the grid:
 * the row-label column width, the column-label band height, and how far the
 * LAST column's label reaches right of that column's centre.
 */
interface AxisLabelExtent {
  rowWidth: number
  colHeight: number
  rightReach: number
}

export function computeMatrixLayout(input: MatrixLayoutInput): MatrixLayout {
  const {
    width,
    height,
    rowLabels,
    colLabels,
    xAxisTitle,
    yAxisTitle,
    cellValueLabels,
    layoutConfig: cfg,
  } = input
  const margin = input.margin ?? 0

  const rowCount = rowLabels.length
  const colCount = colLabels.length
  const safeRowCount = Math.max(1, rowCount)
  const safeColCount = Math.max(1, colCount)
  const fontSize = cfg.LABEL_FONT_SIZE

  // Full names: rows right-aligned, columns rotated −45° from their centre (the
  // band is the rotated extent; the last one leans past the grid's right edge).
  const lastColLabel = colCount ? colLabels[colCount - 1] : ''
  const standard: AxisLabelExtent = {
    rowWidth: estimateMaxLabelWidth(rowLabels, fontSize, cfg.maxLabelLength),
    colHeight: (estimateMaxLabelWidth(colLabels, fontSize, cfg.maxLabelLength) + fontSize) * SIN_45,
    rightReach:
      (labelWidth(truncatedAxisLabel(lastColLabel, fontSize, cfg.maxLabelLength), fontSize) + fontSize / 2) * SIN_45,
  }
  // Compact: index labels (the widest is the count; Ø marks a sentinel row),
  // columns upright and centred.
  const compact: AxisLabelExtent = {
    rowWidth: Math.max(labelWidth(String(rowCount), fontSize), labelWidth('Ø', fontSize)),
    colHeight: fontSize,
    rightReach: labelWidth(String(colCount), fontSize) / 2,
  }

  const legendSpace = MATRIX_LEGEND_GAP + getGradientLegendRequiredHeight(fontSize) + margin

  // Axis space = outer margin + title + title gap + labels + label gap. Title
  // space defaults to one line; the second pass below re-reserves the real
  // (≤2-line) height once the grid extent to wrap to is known.
  const titleLineHeight = axisTitleLineHeight(fontSize)
  const ySpaceFor = (labelW: number, titleW = titleLineHeight) =>
    margin + titleW + PLOT_AXIS_TITLE_GAP + labelW + PLOT_TICK_LABEL_GAP
  const xSpaceFor = (labelH: number, titleH = titleLineHeight) =>
    margin + titleH + PLOT_AXIS_TITLE_GAP + labelH + PLOT_TICK_LABEL_GAP

  // One fit rule for every pass: carve the axis spaces, the right reach and the
  // legend out, fit square cells to the shorter axis (never negative). The right
  // reach hangs from the last column's centre, so half a cell absorbs it: reserve
  // it whole first, then refine by the cell that leaves. Cells only grow under
  // the refinement, so the refined reservation still covers the label.
  const fit = (labels: AxisLabelExtent, ySpace: number, xSpace: number) => {
    const cellFor = (right: number) => {
      const availW = width - ySpace - margin - right
      const availH = height - xSpace - legendSpace
      return Math.max(0, Math.min(availW / safeColCount, availH / safeRowCount))
    }
    const coarse = cellFor(Math.max(PLOT_BORDER_PX, labels.rightReach))
    const right = Math.max(PLOT_BORDER_PX, labels.rightReach - coarse / 2)
    return { cell: cellFor(right), right }
  }
  const fitWith = (labels: AxisLabelExtent) =>
    fit(labels, ySpaceFor(labels.rowWidth), xSpaceFor(labels.colHeight))

  const isCompactMode = fitWith(standard).cell < cfg.COMPACT_THRESHOLD
  const labels = isCompactMode ? compact : standard
  const cellPass1 = fitWith(labels).cell
  const isUltraCompactMode = cellPass1 < cfg.minCellSize

  // Two-pass title reservation (resolveFrameLayout does the same): pass 1 sizes
  // the grid with single-line titles, the titles wrap to that extent, and pass 2
  // reserves their real (≤2-line) height. The wrapped lines are returned for
  // drawMatrixAxisLabels to draw verbatim, so reservation and draw can never
  // disagree on the line count.
  const xTitleLines = wrapAxisTitle(xAxisTitle, Math.max(0, cellPass1 * safeColCount), fontSize)
  const yTitleLines = wrapAxisTitle(yAxisTitle, Math.max(0, cellPass1 * safeRowCount), fontSize)

  const yAxisSpace = ySpaceFor(labels.rowWidth, yTitleLines.length * titleLineHeight)
  const xAxisSpace = xSpaceFor(labels.colHeight, xTitleLines.length * titleLineHeight)
  const final = fit(labels, yAxisSpace, xAxisSpace)

  const availableWidth = width - yAxisSpace - margin - final.right

  // Cells stay square: the shorter axis fits, the longer letterboxes.
  const cellSize =
    rowCount === 0 || colCount === 0
      ? cfg.minCellSize
      : Math.floor(
          isUltraCompactMode
            ? Math.max(1, final.cell)
            : Math.max(cfg.minCellSize, final.cell)
        )

  const gridWidth = cellSize * colCount
  const gridHeight = cellSize * rowCount
  const xOffset = Math.floor(yAxisSpace + ((availableWidth - gridWidth) >> 1))
  const yOffset = Math.floor(xAxisSpace)

  let rowThinFactor = 1
  let colThinFactor = 1
  let showAxisLabels = true

  if (isUltraCompactMode) {
    rowThinFactor = calculateTickStep(rowCount)
    colThinFactor = calculateTickStep(colCount)
  } else if (isCompactMode) {
    rowThinFactor = compactThinFactor(rowCount, fontSize, cellSize)
    colThinFactor = compactThinFactor(colCount, fontSize, cellSize)
    if (cellSize < 5) showAxisLabels = false
  }

  // Cell values show at the largest size whose widest formatted value fits the
  // cell with `pad` to spare; never in ultra-compact.
  const valueFits = (size: number, pad: number) => {
    let widest = 0
    for (const v of cellValueLabels) widest = Math.max(widest, labelWidth(v, size))
    return cellSize >= widest + pad && cellSize >= size + pad - 2
  }
  const defaultCellFontSize = cfg.CELL_VALUE_FONT_SIZE
  const reducedCellFontSize = defaultCellFontSize - 2
  let activeCellValueFontSize: number = defaultCellFontSize
  let showCellValues = false
  if (!isUltraCompactMode) {
    if (valueFits(defaultCellFontSize, 6)) {
      showCellValues = true
    } else if (valueFits(reducedCellFontSize, 4)) {
      showCellValues = true
      activeCellValueFontSize = reducedCellFontSize
    }
  }

  return {
    fontSize,
    xAxisLabelHeight: labels.colHeight,
    yAxisLabelWidth: labels.rowWidth,
    axisTitleGap: PLOT_AXIS_TITLE_GAP,
    xTitleLines,
    yTitleLines,
    xOffset,
    yOffset,
    cellSize,
    gridWidth,
    gridHeight,
    matrixBottom: yOffset + gridHeight,
    rowCount,
    colCount,
    isCompactMode,
    isUltraCompactMode,
    rowThinFactor,
    colThinFactor,
    individualLabelMargin: PLOT_TICK_LABEL_GAP,
    showCellValues,
    showAxisLabels,
    cellValueFontSize: activeCellValueFontSize,
  }
}
