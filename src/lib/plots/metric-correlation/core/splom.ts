import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/textMeasure'
import { UI_COLORS } from '$lib/color'
import { markCrosshairNode, type MatrixLayout } from '$lib/plots/shared'
import { cursorRows } from '$lib/plots/shared/plotCursor.svelte'
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
 * Per-cell scatter projection — ONE geometry, shared by the dots (data pass) and
 * the PLOT CURSOR's ring (overlay pass), so the two can never disagree. Built per
 * cell, not per dot, so the point loop allocates nothing.
 */
function cellProjection(
  layout: MatrixLayout,
  ranges: { min: number; max: number }[],
  row: number,
  col: number
) {
  const { xOffset, yOffset, cellSize } = layout
  const pad = Math.max(3, cellSize * 0.08)
  const inner = cellSize - pad * 2
  const xR = ranges[col]
  const yR = ranges[row]
  const xDen = xR.max - xR.min || 1
  const yDen = yR.max - yR.min || 1
  const innerX = xOffset + col * cellSize + pad
  const innerY = yOffset + row * cellSize + pad
  const dotR = Math.max(1.2, Math.min(2.8, inner / 40))
  return {
    dotR,
    /** Cursor-ring radius: bounded by the cell so it cannot bleed past its edge. */
    ringR: Math.min(dotR + 3, Math.max(dotR + 1, inner / 2)),
    px: (x: number) => innerX + ((x - xR.min) / xDen) * inner,
    py: (y: number) => innerY + inner - ((y - yR.min) / yDen) * inner,
  }
}

/**
 * The PLOT CURSOR's participants, each ringed in every lower-triangle cell where
 * they have a complete pair. Reads the VECTORS, not `cell.points`: the points are
 * NaN-filtered, so a point index is not a participant row.
 */
export function createSplomCursorRing(result: MetricCorrelationResult) {
  const ranges = result.vectors.map(v => rangeOf(v.values))
  const n = result.metrics.length

  return (
    ctx: CanvasRenderingContext2D,
    layout: MatrixLayout,
    participants: readonly number[]
  ) => {
    const rows = cursorRows(result.participantIds, participants)
    if (rows.length === 0) return
    for (let row = 1; row < n; row++) {
      for (let col = 0; col < row; col++) {
        const proj = cellProjection(layout, ranges, row, col)
        for (const p of rows) {
          const x = result.vectors[col].values[p]
          const y = result.vectors[row].values[p]
          if (Number.isNaN(x) || Number.isNaN(y)) continue
          // Standoff, not a hug: `dotR` sits at its 1.2 floor until cells are
          // ~57px, so a fixed +1.5 would read as a slightly bigger dot.
          markCrosshairNode(ctx, proj.px(x), proj.py(y), proj.ringR)
        }
      }
    }
  }
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

  return (ctx: CanvasRenderingContext2D, layout: MatrixLayout) => {
    const { xOffset, yOffset, cellSize } = layout

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
          const proj = cellProjection(layout, ranges, row, col)

          ctx.fillStyle = '#2c3e50'
          ctx.globalAlpha = 0.65
          for (const point of cell.points) {
            ctx.beginPath()
            ctx.arc(proj.px(point.x), proj.py(point.y), proj.dotR, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        }
      }
    }
  }
}
