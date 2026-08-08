import { getContrastTextColor } from '$lib/color'
import {
  truncateTextToPixelWidth,
  SYSTEM_SANS_SERIF_STACK,
} from '$lib/shared/utils/textUtils'
import {
  alignToPixelCenter,
  markCrosshairStrips,
  strokeCrosshairGuides,
  type HighlightRect,
} from '$lib/plots/shared/canvasUtils'
import { UI_COLORS } from '$lib/color'
import type { MatrixLayout } from './matrixLayout'

export type MatrixRenderConfig = {
  layout: MatrixLayout
  /** Row (y-axis) labels, top-to-bottom. length === layout.rowCount. */
  rowLabels: string[]
  /** Column (x-axis) labels, left-to-right. length === layout.colCount. */
  colLabels: string[]
  /** Flat row-major values (rowCount × colCount). */
  matrix: Float64Array | number[]
  maxLabelLength: number
  xAxisTitle: string
  yAxisTitle: string
  formatCellValue: (value: number) => string
  getCellColor: (value: number) => string
  showCellValue?: (value: number) => boolean
  hasLastRowSentinel?: boolean
  /**
   * Custom cell-content painter (e.g. the SPLOM's scatter/r-value cells, or the
   * metric matrix's NA-bucket fills). Replaces the heat-cell fill + per-cell value
   * text; the grid is then drawn ON TOP of the content, and axis/row/column
   * labels render as usual.
   */
  drawCells?: (ctx: CanvasRenderingContext2D, layout: MatrixLayout) => void
}

function setUpFont(ctx: CanvasRenderingContext2D) {
  ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
  ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
}

function drawMatrixGrid(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig
) {
  ctx.strokeStyle = UI_COLORS.BORDER_DEFAULT
  ctx.lineWidth = 0.5
  const { xOffset, yOffset, cellSize, gridWidth, gridHeight, rowCount, colCount } =
    config.layout

  for (let col = 0; col <= colCount; col++) {
    const x = alignToPixelCenter(xOffset + col * cellSize)
    ctx.beginPath()
    ctx.moveTo(x, yOffset)
    ctx.lineTo(x, yOffset + gridHeight)
    ctx.stroke()
  }

  for (let row = 0; row <= rowCount; row++) {
    const y = alignToPixelCenter(yOffset + row * cellSize)
    ctx.beginPath()
    ctx.moveTo(xOffset, y)
    ctx.lineTo(xOffset + gridWidth, y)
    ctx.stroke()
  }
}

// Reused scratch of per-cell fill colours. drawMatrixCells fills it and
// drawMatrixCellsText reads it (same render, cells always drawn first), so
// getCellColor — which builds an interpolated colour string — runs ONCE per cell
// instead of a second time for the text-contrast pass. Grown, never shrunk;
// indices ≥ rowCount·colCount are stale but never read (the fill pass rewrites
// [0, rowCount·colCount)).
let _cellColors: string[] = []

function drawMatrixCells(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig
) {
  const { xOffset, yOffset, cellSize, rowCount, colCount } = config.layout
  const cellCount = rowCount * colCount
  if (_cellColors.length < cellCount) _cellColors = new Array<string>(cellCount)
  const colors = _cellColors

  for (let row = 0; row < rowCount; row++) {
    const rowOffset = row * colCount
    for (let col = 0; col < colCount; col++) {
      const value = config.matrix[rowOffset + col] ?? 0
      const x = xOffset + col * cellSize
      const y = yOffset + row * cellSize
      const color = config.getCellColor(value)
      colors[rowOffset + col] = color
      ctx.fillStyle = color
      ctx.fillRect(x, y, cellSize, cellSize)
    }
  }
}

function drawMatrixCellsText(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig
) {
  const { layout } = config
  if (!layout.showCellValues) return

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const { xOffset, yOffset, cellSize, cellValueFontSize, rowCount, colCount } = layout
  ctx.font = `${cellValueFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
  const showCellValue = config.showCellValue ?? (() => true)
  // Reuse the fill colours computed in drawMatrixCells (run just before this).
  const colors = _cellColors

  for (let row = 0; row < rowCount; row++) {
    const rowOffset = row * colCount
    for (let col = 0; col < colCount; col++) {
      const value = config.matrix[rowOffset + col] ?? 0
      if (!showCellValue(value)) continue

      const displayValue = config.formatCellValue(value)
      ctx.fillStyle = getContrastTextColor(colors[rowOffset + col] ?? config.getCellColor(value))
      const x = xOffset + col * cellSize
      const y = yOffset + row * cellSize
      ctx.fillText(displayValue, x + cellSize * 0.5, y + cellSize * 0.5 + 1)
    }
  }
}

function drawMatrixAxisLabels(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig
) {
  setUpFont(ctx)
  const { layout } = config
  const {
    xOffset,
    yOffset,
    gridWidth,
    gridHeight,
    xAxisLabelHeight,
    yAxisLabelWidth,
    axisTitleGap,
  } = layout

  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const xTitleY = yOffset - xAxisLabelHeight - axisTitleGap
  ctx.fillText(config.xAxisTitle, xOffset + gridWidth * 0.5, xTitleY)

  ctx.save()
  const yTitleX = xOffset - yAxisLabelWidth - axisTitleGap
  const yTitleY = yOffset + gridHeight * 0.5
  ctx.translate(yTitleX, yTitleY)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(config.yAxisTitle, 0, 0)
  ctx.restore()
}

function shouldSkipLabel(
  index: number,
  thinFactor: number,
  layout: MatrixLayout
): boolean {
  if (layout.isUltraCompactMode) return index % thinFactor !== 0
  if (layout.isCompactMode) return (index + 1) % thinFactor !== 0
  return false
}

function getCompactLabel(
  index: number,
  count: number,
  layout: MatrixLayout,
  hasLastRowSentinel: boolean
): string {
  if (hasLastRowSentinel && index === count - 1) return 'Ø'
  return layout.isUltraCompactMode ? index.toString() : (index + 1).toString()
}

function drawMatrixRowLabels(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig,
  labelFontSize: number
) {
  const { layout, rowLabels } = config
  if (!layout.showAxisLabels) return
  const hasLastRowSentinel = config.hasLastRowSentinel ?? false

  ctx.textAlign = 'end'
  ctx.textBaseline = 'middle'

  for (let row = 0; row < rowLabels.length; row++) {
    if (shouldSkipLabel(row, layout.rowThinFactor, layout)) continue

    const x = layout.xOffset - layout.individualLabelMargin
    const y = layout.yOffset + row * layout.cellSize + layout.cellSize * 0.5 + 1

    if (layout.isUltraCompactMode) {
      ctx.beginPath()
      ctx.moveTo(layout.xOffset, y - 1)
      ctx.lineTo(layout.xOffset - 4, y - 1)
      ctx.strokeStyle = UI_COLORS.TEXT_SECONDARY
      ctx.stroke()
    }

    const labelText = layout.isCompactMode
      ? getCompactLabel(row, rowLabels.length, layout, hasLastRowSentinel)
      : truncateTextToPixelWidth(
          rowLabels[row],
          config.maxLabelLength,
          labelFontSize,
          SYSTEM_SANS_SERIF_STACK,
          '...'
        )

    ctx.fillText(labelText, x, y)
  }
}

function drawMatrixColumnLabels(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig,
  labelFontSize: number
) {
  const { layout, colLabels } = config
  if (!layout.showAxisLabels) return
  const hasLastRowSentinel = config.hasLastRowSentinel ?? false

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  for (let col = 0; col < colLabels.length; col++) {
    if (shouldSkipLabel(col, layout.colThinFactor, layout)) continue

    const x = layout.xOffset + col * layout.cellSize + layout.cellSize * 0.5
    const y = layout.yOffset - layout.individualLabelMargin

    if (layout.isUltraCompactMode) {
      ctx.beginPath()
      ctx.moveTo(x, layout.yOffset)
      ctx.lineTo(x, layout.yOffset - 4)
      ctx.strokeStyle = UI_COLORS.TEXT_SECONDARY
      ctx.stroke()
    }

    ctx.save()
    ctx.translate(x, y)
    if (!layout.isCompactMode) {
      ctx.rotate(-Math.PI / 4)
    } else {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
    }

    const labelText = layout.isCompactMode
      ? getCompactLabel(col, colLabels.length, layout, hasLastRowSentinel)
      : truncateTextToPixelWidth(
          colLabels[col],
          config.maxLabelLength,
          labelFontSize,
          SYSTEM_SANS_SERIF_STACK,
          '...'
        )

    ctx.fillText(labelText, 0, 0)
    ctx.restore()
  }
}

/**
 * Renders the core matrix drawing (grid, cells, labels, cell text).
 * Legend and tooltip handling remain in the component.
 */
export function renderMatrixContent(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig
) {
  if (config.drawCells) {
    config.drawCells(ctx, config.layout)
    drawMatrixGrid(ctx, config)
  } else {
    drawMatrixGrid(ctx, config)
    drawMatrixCells(ctx, config)
  }
  setUpFont(ctx)
  drawMatrixAxisLabels(ctx, config)
  ctx.font = `${config.layout.fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
  drawMatrixRowLabels(ctx, config, config.layout.fontSize)
  drawMatrixColumnLabels(ctx, config, config.layout.fontSize)
  if (!config.drawCells) drawMatrixCellsText(ctx, config)
}

/**
 * Everyone a hovered cell designates: its row participant, its column participant,
 * or both — deduped and sorted, so a similarity matrix's diagonal (A, A) is one
 * person, mirrored cells are one value, and an axis that is not participants (a
 * stimulus, an AOI, a metric) contributes nothing.
 */
export function matrixCellParticipants(
  rowIds: readonly number[] | undefined,
  colIds: readonly number[] | undefined,
  cell: { row: number; col: number }
): number[] {
  const ids: number[] = []
  const row = rowIds?.[cell.row]
  const col = colIds?.[cell.col]
  if (row !== undefined) ids.push(row)
  if (col !== undefined && col !== row) ids.push(col)
  return ids.sort((a, b) => a - b)
}

type MatrixGeom = Pick<
  MatrixLayout,
  'xOffset' | 'yOffset' | 'cellSize' | 'gridWidth' | 'gridHeight'
>

const MATRIX_STRIP_ALPHA = 0.18

function matrixRowRect(geom: MatrixGeom, row: number): HighlightRect {
  const { xOffset, yOffset, cellSize, gridWidth } = geom
  return {
    x: xOffset,
    y: yOffset + row * cellSize,
    width: gridWidth,
    height: cellSize,
    along: 'x',
    alpha: MATRIX_STRIP_ALPHA,
  }
}

function matrixColRect(geom: MatrixGeom, col: number): HighlightRect {
  const { xOffset, yOffset, cellSize, gridHeight } = geom
  return {
    x: xOffset + col * cellSize,
    y: yOffset,
    width: cellSize,
    height: gridHeight,
    along: 'y',
    alpha: MATRIX_STRIP_ALPHA,
  }
}

/**
 * The PLOT CURSOR's participants: the SAME strip mark the local crosshair below
 * uses, for whichever strips this matrix shows them in.
 */
export function drawMatrixParticipantStrips(
  ctx: CanvasRenderingContext2D,
  geom: MatrixGeom,
  at: { rows: readonly number[]; cols: readonly number[] }
): void {
  if (at.rows.length === 0 && at.cols.length === 0) return
  const rects: HighlightRect[] = []
  for (const row of at.rows) rects.push(matrixRowRect(geom, row))
  for (const col of at.cols) rects.push(matrixColRect(geom, col))
  markCrosshairStrips(ctx, rects)
}

/**
 * Hover crosshair over a matrix: the hovered cell's row AND column strips, both
 * marked together with outer dashed lines and no inner lines at the crossing.
 */
export function drawMatrixCrosshair(
  ctx: CanvasRenderingContext2D,
  geom: MatrixGeom,
  cell: { row: number; col: number }
): void {
  markCrosshairStrips(ctx, [
    matrixColRect(geom, cell.col),
    matrixRowRect(geom, cell.row),
  ])
}

/** Map canvas coords to a matrix cell (display space), or null outside. */
export function matrixCellAt(
  geom: Pick<MatrixLayout, 'xOffset' | 'yOffset' | 'cellSize'>,
  mx: number,
  my: number,
  rowCount: number,
  colCount: number
): { row: number; col: number } | null {
  const col = Math.floor((mx - geom.xOffset) / geom.cellSize)
  const row = Math.floor((my - geom.yOffset) / geom.cellSize)
  if (row < 0 || row >= rowCount || col < 0 || col >= colCount) return null
  return { row, col }
}
