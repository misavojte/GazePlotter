import { TRANSITION_MATRIX_LAYOUT } from '../const'

const NICE_STEPS = [5, 10, 20, 25, 50, 100, 200, 500, 1000] as const
const AXIS_TITLE_GAP = 12
const SIN_45 = 0.7071
const APPROX_CHAR_WIDTH = 0.6
const COMPACT_LABEL_SIZE = 25

export type TransitionMatrixLayoutInput = {
  width: number
  height: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  aoiLabels: string[]
  effectiveMaxValue: number
}

export type TransitionMatrixLayout = {
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
  for (let i = 0; i < NICE_STEPS.length; i++) {
    if (count / NICE_STEPS[i] <= 10) return NICE_STEPS[i]
  }
  return 1000
}

function estimateMaxLabelWidth(
  labels: string[],
  fontSize: number,
  maxLabelLength: number
): number {
  const approxCharWidth = fontSize * APPROX_CHAR_WIDTH
  let maxPixelWidth = 0

  for (let i = 0; i < labels.length; i++) {
    const width = labels[i].length * approxCharWidth
    if (width > maxPixelWidth) maxPixelWidth = width
  }

  return Math.min(maxPixelWidth, maxLabelLength)
}

function formatCellValue(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1)
}

export function computeTransitionMatrixLayout(
  input: TransitionMatrixLayoutInput
): TransitionMatrixLayout {
  const {
    width,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    aoiLabels,
    effectiveMaxValue,
  } = input

  const aoiCount = aoiLabels.length
  const safeCount = Math.max(1, aoiCount)
  const fontSize = TRANSITION_MATRIX_LAYOUT.LABEL_FONT_SIZE

  const effectiveMaxLabelWidth = estimateMaxLabelWidth(
    aoiLabels,
    fontSize,
    TRANSITION_MATRIX_LAYOUT.maxLabelLength
  )

  const standardAxisLabelSize = effectiveMaxLabelWidth
  const standardXAxisHeight =
    standardAxisLabelSize * SIN_45 + fontSize * SIN_45

  const standardYSpace =
    marginLeft +
    TRANSITION_MATRIX_LAYOUT.leftMargin +
    fontSize +
    AXIS_TITLE_GAP +
    standardAxisLabelSize +
    10

  const standardXSpace =
    marginTop +
    TRANSITION_MATRIX_LAYOUT.topMargin +
    fontSize +
    AXIS_TITLE_GAP +
    standardXAxisHeight +
    10

  const legendSpace = 70 + marginBottom

  const availableWidthStandard =
    width -
    standardYSpace -
    marginRight -
    TRANSITION_MATRIX_LAYOUT.rightMargin

  const availableHeightStandard = height - standardXSpace - legendSpace

  const cellStandard = Math.max(
    0,
    Math.min(availableWidthStandard / safeCount, availableHeightStandard / safeCount)
  )

  const needsCompact = cellStandard < TRANSITION_MATRIX_LAYOUT.COMPACT_THRESHOLD

  const compactYSpace =
    marginLeft +
    TRANSITION_MATRIX_LAYOUT.leftMargin +
    fontSize +
    AXIS_TITLE_GAP +
    COMPACT_LABEL_SIZE +
    10

  const compactXSpace =
    marginTop +
    TRANSITION_MATRIX_LAYOUT.topMargin +
    fontSize +
    AXIS_TITLE_GAP +
    COMPACT_LABEL_SIZE +
    10

  const activeYSpace = needsCompact ? compactYSpace : standardYSpace
  const activeXSpace = needsCompact ? compactXSpace : standardXSpace

  const availableWidthReal =
    width -
    activeYSpace -
    marginRight -
    TRANSITION_MATRIX_LAYOUT.rightMargin

  const availableHeightReal = height - activeXSpace - legendSpace

  const cellReal = Math.max(
    0,
    Math.min(availableWidthReal / safeCount, availableHeightReal / safeCount)
  )

  const isUltraCompactMode = cellReal < TRANSITION_MATRIX_LAYOUT.minCellSize
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
    marginLeft +
    TRANSITION_MATRIX_LAYOUT.leftMargin +
    fontSize +
    AXIS_TITLE_GAP +
    yAxisLabelWidth +
    10

  const xAxisSpace =
    marginTop +
    TRANSITION_MATRIX_LAYOUT.topMargin +
    fontSize +
    AXIS_TITLE_GAP +
    xAxisLabelHeight +
    10

  const availableWidth =
    width - yAxisSpace - marginRight - TRANSITION_MATRIX_LAYOUT.rightMargin

  const availableHeight = height - xAxisSpace - legendSpace

  const cellSize =
    aoiCount === 0
      ? TRANSITION_MATRIX_LAYOUT.minCellSize
      : Math.floor(
          isUltraCompactMode
            ? Math.max(
                1,
                Math.min(availableWidth / aoiCount, availableHeight / aoiCount)
              )
            : Math.max(
                TRANSITION_MATRIX_LAYOUT.minCellSize,
                Math.min(availableWidth / aoiCount, availableHeight / aoiCount)
              )
        )

  const gridWidth = cellSize * aoiCount
  const gridHeight = cellSize * aoiCount
  const xOffset = Math.floor(yAxisSpace + ((availableWidth - gridWidth) >> 1))
  const yOffset = Math.floor(xAxisSpace)

  let thinFactor = 1
  let showAxisLabels = true

  if (isUltraCompactMode) {
    thinFactor = calculateTickStep(aoiCount)
  } else if (isCompactMode) {
    const maxIndexStr = aoiCount.toString()
    const approxIndexWidth = maxIndexStr.length * (fontSize * APPROX_CHAR_WIDTH)
    thinFactor = Math.max(1, Math.ceil((approxIndexWidth + 4) / cellSize))

    if (cellSize < 5) showAxisLabels = false
  }

  const valueStr = formatCellValue(effectiveMaxValue)
  const labelLen = Math.max(valueStr.length, effectiveMaxValue < 1 ? 3 : 0)

  const defaultCellFontSize = TRANSITION_MATRIX_LAYOUT.CELL_VALUE_FONT_SIZE
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
