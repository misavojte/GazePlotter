import { getContrastTextColor } from '$lib/color'
import {
  truncateTextToPixelWidth,
  SYSTEM_SANS_SERIF_STACK,
} from '$lib/shared/utils/textUtils'
import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
import { UI_COLORS } from '$lib/color'
import type { SquareMatrixLayout } from './matrixLayout'

export type MatrixRenderConfig = {
  layout: SquareMatrixLayout
  labels: string[]
  matrix: Float64Array | number[]
  maxLabelLength: number
  xAxisTitle: string
  yAxisTitle: string
  formatCellValue: (value: number) => string
  getCellColor: (value: number) => string
  showCellValue?: (value: number) => boolean
  hasLastRowSentinel?: boolean
}

function setUpFont(ctx: CanvasRenderingContext2D) {
  ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
  ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
}

export function drawMatrixGrid(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig
) {
  ctx.strokeStyle = UI_COLORS.BORDER_DEFAULT
  ctx.lineWidth = 0.5
  const { xOffset, yOffset, cellSize, gridWidth, gridHeight } = config.layout
  const size = config.labels.length

  for (let col = 0; col <= size; col++) {
    const x = alignToPixelCenter(xOffset + col * cellSize)
    ctx.beginPath()
    ctx.moveTo(x, yOffset)
    ctx.lineTo(x, yOffset + gridHeight)
    ctx.stroke()
  }

  for (let row = 0; row <= size; row++) {
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
// indices ≥ size² are stale but never read (the fill pass rewrites [0, size²)).
let _cellColors: string[] = []

function drawMatrixCells(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig
) {
  const { xOffset, yOffset, cellSize } = config.layout
  const size = config.labels.length
  const cellCount = size * size
  if (_cellColors.length < cellCount) _cellColors = new Array<string>(cellCount)
  const colors = _cellColors

  for (let row = 0; row < size; row++) {
    const rowOffset = row * size
    for (let col = 0; col < size; col++) {
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
  const { xOffset, yOffset, cellSize, cellValueFontSize } = layout
  ctx.font = `${cellValueFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
  const size = config.labels.length
  const showCellValue = config.showCellValue ?? (() => true)
  // Reuse the fill colours computed in drawMatrixCells (run just before this).
  const colors = _cellColors

  for (let row = 0; row < size; row++) {
    const rowOffset = row * size
    for (let col = 0; col < size; col++) {
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

export function drawMatrixAxisLabels(
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
  layout: SquareMatrixLayout
): boolean {
  if (layout.isUltraCompactMode) return index % layout.thinFactor !== 0
  if (layout.isCompactMode) return (index + 1) % layout.thinFactor !== 0
  return false
}

function getCompactLabel(
  index: number,
  count: number,
  layout: SquareMatrixLayout,
  hasLastRowSentinel: boolean
): string {
  if (hasLastRowSentinel && index === count - 1) return 'Ø'
  return layout.isUltraCompactMode ? index.toString() : (index + 1).toString()
}

export function drawMatrixRowLabels(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig,
  labelFontSize: number
) {
  const { layout, labels } = config
  if (!layout.showAxisLabels) return
  const hasLastRowSentinel = config.hasLastRowSentinel ?? false

  ctx.textAlign = 'end'
  ctx.textBaseline = 'middle'

  for (let row = 0; row < labels.length; row++) {
    if (shouldSkipLabel(row, layout)) continue

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
      ? getCompactLabel(row, labels.length, layout, hasLastRowSentinel)
      : truncateTextToPixelWidth(
          labels[row],
          config.maxLabelLength,
          labelFontSize,
          SYSTEM_SANS_SERIF_STACK,
          '...'
        )

    ctx.fillText(labelText, x, y)
  }
}

export function drawMatrixColumnLabels(
  ctx: CanvasRenderingContext2D,
  config: MatrixRenderConfig,
  labelFontSize: number
) {
  const { layout, labels } = config
  if (!layout.showAxisLabels) return
  const hasLastRowSentinel = config.hasLastRowSentinel ?? false

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  for (let col = 0; col < labels.length; col++) {
    if (shouldSkipLabel(col, layout)) continue

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
      ? getCompactLabel(col, labels.length, layout, hasLastRowSentinel)
      : truncateTextToPixelWidth(
          labels[col],
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
  drawMatrixGrid(ctx, config)
  drawMatrixCells(ctx, config)
  setUpFont(ctx)
  drawMatrixAxisLabels(ctx, config)
  ctx.font = `${config.layout.fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
  drawMatrixRowLabels(ctx, config, config.layout.fontSize)
  drawMatrixColumnLabels(ctx, config, config.layout.fontSize)
  drawMatrixCellsText(ctx, config)
}
