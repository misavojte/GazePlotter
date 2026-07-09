import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
import { UI_COLORS } from '$lib/color'
import type { SquareMatrixLayout } from '$lib/plots/shared'
import type { MetricCorrelationResult } from '../types'

function rangeOf(values: number[]): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (Number.isNaN(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 }
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.05 : 1
    return { min: min - pad, max: max + pad }
  }
  return { min, max }
}

function cellBackground(r: number | null): string {
  if (r === null) return '#fafafa'
  const clamped = Math.max(-1, Math.min(1, r))
  const alpha = Math.abs(clamped) * 0.12
  if (clamped >= 0) return `rgba(202, 0, 32, ${alpha.toFixed(3)})`
  return `rgba(33, 102, 172, ${alpha.toFixed(3)})`
}

function rColor(r: number): string {
  if (Math.abs(r) < 0.5) return '#555'
  return r > 0 ? '#a00015' : '#1a4a8a'
}

/**
 * SPLOM cell painter for `MatrixPlotFigure.drawCells`: diagonal shows the
 * metric unit, upper triangle the r value, lower triangle a scatter of the
 * per-participant value pairs. Per-metric value ranges place the scatter
 * points inside each cell.
 */
export function createSplomCellRenderer(result: MetricCorrelationResult) {
  const ranges = result.vectors.map(v => rangeOf(v.values))
  const n = result.metrics.length

  return (ctx: CanvasRenderingContext2D, layout: SquareMatrixLayout) => {
    const { xOffset, yOffset, cellSize } = layout
    const pad = Math.max(3, cellSize * 0.08)
    const innerSize = cellSize - pad * 2

    const scatterFontSize = Math.min(14, Math.max(9, cellSize / 5))
    const rFontSize = Math.min(20, Math.max(11, cellSize / 3.2))

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const cell = result.cells[row * n + col]
        const x = xOffset + col * cellSize
        const y = yOffset + row * cellSize

        if (row === col) {
          ctx.fillStyle = '#f0f0f0'
          ctx.fillRect(x, y, cellSize, cellSize)
          ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
          ctx.font = `500 ${scatterFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            result.metrics[row].unit || result.metrics[row].label,
            x + cellSize / 2,
            y + cellSize / 2
          )
          continue
        }

        ctx.fillStyle = cellBackground(cell.r)
        ctx.fillRect(x, y, cellSize, cellSize)

        if (row < col) {
          // Upper triangle: r value
          const label = cell.r === null ? '—' : cell.r.toFixed(2)
          ctx.font = `600 ${rFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
          ctx.fillStyle = cell.r === null ? '#999' : rColor(cell.r)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, x + cellSize / 2, y + cellSize / 2)
        } else {
          // Lower triangle: scatter
          if (!cell.points || cell.points.length === 0) continue
          const xRange = ranges[col]
          const yRange = ranges[row]
          const xDen = xRange.max - xRange.min || 1
          const yDen = yRange.max - yRange.min || 1
          const innerX = x + pad
          const innerY = y + pad
          const dotR = Math.max(1.2, Math.min(2.8, innerSize / 40))

          ctx.fillStyle = '#2c3e50'
          ctx.globalAlpha = 0.65
          for (const point of cell.points) {
            const px = innerX + ((point.x - xRange.min) / xDen) * innerSize
            const py =
              innerY + innerSize - ((point.y - yRange.min) / yDen) * innerSize
            ctx.beginPath()
            ctx.arc(px, py, dotR, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        }
      }
    }
  }
}
