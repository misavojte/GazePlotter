import { getGradientLegendRequiredHeight } from './legendGradient'
import type { CanvasPlotMargins } from './useCanvasPlot.svelte'

const NICE_STEPS = [5, 10, 20, 25, 50, 100, 200, 500, 1000] as const
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

export type SquareMatrixLayoutInput = {
  width: number
  height: number
  labels: string[]
  cellValueLabelLength: number
  layoutConfig: MatrixLayoutConfig
  margins: CanvasPlotMargins
}

export type SquareMatrixLayout = {
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
  isCompactMode: boolean
  isUltraCompactMode: boolean
  thinFactor: number
  individualLabelMargin: number
  showCellValues: boolean
  showAxisLabels: boolean
  cellValueFontSize: number
}

function calculateTickStep(count: number): number {
  return NICE_STEPS.find(step => count / step <= 10) ?? 1000
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

export function computeSquareMatrixLayout(
  input: SquareMatrixLayoutInput
): SquareMatrixLayout {
  const {
    width,
    height,
    labels,
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

  const count = labels.length
  const safeCount = Math.max(1, count)
  const fontSize = cfg.LABEL_FONT_SIZE

  const effectiveMaxLabelWidth = estimateMaxLabelWidth(
    labels,
    fontSize,
    cfg.maxLabelLength
  )

  const standardAxisLabelSize = effectiveMaxLabelWidth
  const standardXAxisHeight = effectiveMaxLabelWidth * SIN_45 + fontSize * SIN_45

  const standardYSpace =
    marginLeft + cfg.leftMargin + fontSize + AXIS_TITLE_GAP + standardAxisLabelSize + 10

  const standardXSpace =
    marginTop + cfg.topMargin + fontSize + AXIS_TITLE_GAP + standardXAxisHeight + 10

  const legendSpace = MATRIX_LEGEND_GAP + getGradientLegendRequiredHeight(fontSize) + marginBottom

  const availableWidthStandard =
    width - standardYSpace - marginRight - cfg.rightMargin
  const availableHeightStandard = height - standardXSpace - legendSpace

  const cellStandard = Math.max(
    0,
    Math.min(availableWidthStandard / safeCount, availableHeightStandard / safeCount)
  )

  const needsCompact = cellStandard < cfg.COMPACT_THRESHOLD

  const compactYSpace =
    marginLeft + cfg.leftMargin + fontSize + AXIS_TITLE_GAP + COMPACT_LABEL_SIZE + 10

  const compactXSpace =
    marginTop + cfg.topMargin + fontSize + AXIS_TITLE_GAP + COMPACT_LABEL_SIZE + 10

  const activeYSpace = needsCompact ? compactYSpace : standardYSpace
  const activeXSpace = needsCompact ? compactXSpace : standardXSpace

  const availableWidthReal =
    width - activeYSpace - marginRight - cfg.rightMargin
  const availableHeightReal = height - activeXSpace - legendSpace

  const cellReal = Math.max(
    0,
    Math.min(availableWidthReal / safeCount, availableHeightReal / safeCount)
  )

  const isUltraCompactMode = cellReal < cfg.minCellSize
  const isCompactMode = needsCompact || isUltraCompactMode

  let xAxisLabelHeight: number
  let yAxisLabelWidth: number

  if (isCompactMode) {
    xAxisLabelHeight = COMPACT_LABEL_SIZE
    yAxisLabelWidth = COMPACT_LABEL_SIZE
  } else {
    yAxisLabelWidth = effectiveMaxLabelWidth
    xAxisLabelHeight = effectiveMaxLabelWidth * SIN_45 + fontSize * SIN_45
  }

  const yAxisSpace =
    marginLeft + cfg.leftMargin + fontSize + AXIS_TITLE_GAP + yAxisLabelWidth + 10

  const xAxisSpace =
    marginTop + cfg.topMargin + fontSize + AXIS_TITLE_GAP + xAxisLabelHeight + 10

  const availableWidth = width - yAxisSpace - marginRight - cfg.rightMargin
  const availableHeight = height - xAxisSpace - legendSpace

  const cellSize =
    count === 0
      ? cfg.minCellSize
      : Math.floor(
          isUltraCompactMode
            ? Math.max(
                1,
                Math.min(availableWidth / count, availableHeight / count)
              )
            : Math.max(
                cfg.minCellSize,
                Math.min(availableWidth / count, availableHeight / count)
              )
        )

  const gridWidth = cellSize * count
  const gridHeight = cellSize * count
  const xOffset = Math.floor(yAxisSpace + ((availableWidth - gridWidth) >> 1))
  const yOffset = Math.floor(xAxisSpace)

  let thinFactor = 1
  let showAxisLabels = true

  if (isUltraCompactMode) {
    thinFactor = calculateTickStep(count)
  } else if (isCompactMode) {
    const maxIndexStr = count.toString()
    const approxIndexWidth = maxIndexStr.length * (fontSize * APPROX_CHAR_WIDTH)
    thinFactor = Math.max(1, Math.ceil((approxIndexWidth + 4) / cellSize))
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
    isCompactMode,
    isUltraCompactMode,
    thinFactor,
    individualLabelMargin: 10,
    showCellValues,
    showAxisLabels,
    cellValueFontSize: activeCellValueFontSize,
  }
}
