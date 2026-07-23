import { getGradientLegendRequiredHeight } from './legendGradient'
import { calculateTickStep } from './axisUtils'
import type { CanvasPlotMargins } from './usePlot.svelte'

const AXIS_TITLE_GAP = 12
const SIN_45 = 0.7071
const APPROX_CHAR_WIDTH = 0.6
const COMPACT_LABEL_SIZE = 25

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
  horizontalPadding: 50,
  baseLabelOffset: 5,
  topMargin: 0,
  leftMargin: 30,
  rightMargin: 10,
  minCellSize: 20,
  maxLabelLength: 85,
  COMPACT_THRESHOLD: 26,
  THIN_THRESHOLD: 15,
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
  cellValueLabelLength: number
  layoutConfig: MatrixLayoutConfig
  margins: CanvasPlotMargins
}

export type MatrixLayout = {
  fontSize: number
  xAxisLabelHeight: number
  yAxisLabelWidth: number
  axisTitleGap: number
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

function estimateMaxLabelWidth(
  labels: string[],
  fontSize: number,
  maxLabelLength: number
): number {
  const approxCharWidth = fontSize * APPROX_CHAR_WIDTH
  const maxPixelWidth = labels.reduce(
    (max, label) => Math.max(max, label.length * approxCharWidth),
    0
  )
  return Math.min(maxPixelWidth, maxLabelLength)
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
  const approxIndexWidth = count.toString().length * (fontSize * APPROX_CHAR_WIDTH)
  return Math.max(1, Math.ceil((approxIndexWidth + 4) / cellSize))
}

export function computeMatrixLayout(input: MatrixLayoutInput): MatrixLayout {
  const {
    width,
    height,
    rowLabels,
    colLabels,
    cellValueLabelLength: labelLen,
    layoutConfig: cfg,
  } = input
  // Adapt the geometry margins to the local names the math below uses.
  const {
    top: marginTop,
    right: marginRight,
    bottom: marginBottom,
    left: marginLeft,
  } = input.margins

  const rowCount = rowLabels.length
  const colCount = colLabels.length
  const safeRowCount = Math.max(1, rowCount)
  const safeColCount = Math.max(1, colCount)
  const fontSize = cfg.LABEL_FONT_SIZE

  // y-axis labels come from rows, x-axis (rotated) labels from columns.
  const maxRowLabelWidth = estimateMaxLabelWidth(rowLabels, fontSize, cfg.maxLabelLength)
  const maxColLabelWidth = estimateMaxLabelWidth(colLabels, fontSize, cfg.maxLabelLength)

  const standardYAxisLabelWidth = maxRowLabelWidth
  const standardXAxisHeight = maxColLabelWidth * SIN_45 + fontSize * SIN_45

  const legendSpace = MATRIX_LEGEND_GAP + getGradientLegendRequiredHeight(fontSize) + marginBottom

  // Axis space = outer margin + config margin + axis title + gap + labels + pad.
  const ySpaceFor = (labelWidth: number) =>
    marginLeft + cfg.leftMargin + fontSize + AXIS_TITLE_GAP + labelWidth + 10
  const xSpaceFor = (labelHeight: number) =>
    marginTop + cfg.topMargin + fontSize + AXIS_TITLE_GAP + labelHeight + 10

  // One fit rule for every pass: carve the axis spaces + legend out, fit
  // square cells to the shorter axis (never negative).
  const cellFor = (ySpace: number, xSpace: number) => {
    const availW = width - ySpace - marginRight - cfg.rightMargin
    const availH = height - xSpace - legendSpace
    return Math.max(0, Math.min(availW / safeColCount, availH / safeRowCount))
  }

  const standardYSpace = ySpaceFor(standardYAxisLabelWidth)
  const standardXSpace = xSpaceFor(standardXAxisHeight)

  const cellStandard = cellFor(standardYSpace, standardXSpace)

  const needsCompact = cellStandard < cfg.COMPACT_THRESHOLD

  const cellReal = cellFor(
    needsCompact ? ySpaceFor(COMPACT_LABEL_SIZE) : standardYSpace,
    needsCompact ? xSpaceFor(COMPACT_LABEL_SIZE) : standardXSpace
  )

  const isUltraCompactMode = cellReal < cfg.minCellSize
  const isCompactMode = needsCompact || isUltraCompactMode

  const yAxisLabelWidth = isCompactMode ? COMPACT_LABEL_SIZE : standardYAxisLabelWidth
  const xAxisLabelHeight = isCompactMode ? COMPACT_LABEL_SIZE : standardXAxisHeight

  const yAxisSpace = ySpaceFor(yAxisLabelWidth)
  const xAxisSpace = xSpaceFor(xAxisLabelHeight)

  const availableWidth = width - yAxisSpace - marginRight - cfg.rightMargin

  // Cells stay square: the shorter axis fits, the longer letterboxes.
  const cellSize =
    rowCount === 0 || colCount === 0
      ? cfg.minCellSize
      : Math.floor(
          isUltraCompactMode
            ? Math.max(1, cellFor(yAxisSpace, xAxisSpace))
            : Math.max(cfg.minCellSize, cellFor(yAxisSpace, xAxisSpace))
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

  const defaultCellFontSize = cfg.CELL_VALUE_FONT_SIZE
  const reducedCellFontSize = defaultCellFontSize - 2

  let activeCellValueFontSize: number = defaultCellFontSize
  let showCellValues = false

  const widthPass1 = labelLen * (defaultCellFontSize * 0.75)
  if (
    !isUltraCompactMode &&
    cellSize >= widthPass1 + 6 &&
    cellSize >= defaultCellFontSize + 4
  ) {
    showCellValues = true
    activeCellValueFontSize = defaultCellFontSize
  } else {
    const widthPass2 = labelLen * (reducedCellFontSize * 0.75)
    if (
      !isUltraCompactMode &&
      cellSize >= widthPass2 + 4 &&
      cellSize >= reducedCellFontSize + 2
    ) {
      showCellValues = true
      activeCellValueFontSize = reducedCellFontSize
    }
  }

  return {
    fontSize,
    xAxisLabelHeight,
    yAxisLabelWidth,
    axisTitleGap: AXIS_TITLE_GAP,
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
    individualLabelMargin: 10,
    showCellValues,
    showAxisLabels,
    cellValueFontSize: activeCellValueFontSize,
  }
}
