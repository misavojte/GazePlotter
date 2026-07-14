import { getColorForValue, getContrastTextColor } from '$lib/color'
import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
import type { MatrixLayout } from '$lib/plots/shared'
import { METRIC_MATRIX_NA_FLAG_COLOR, METRIC_MATRIX_NA_NEUTRAL_COLOR } from '../const'
import type { MetricMatrixData } from '../types'

/**
 * `MatrixPlotFigure.drawCells` painter for the metric matrix (SPLOM-style — cf.
 * `metric-correlation/core/splom.ts`). Per cell it reads the parallel
 * `state[i]`:
 *   - `null`                        → the shared `getColorForValue` gradient.
 *   - not-usable (`no-fixations` /
 *     `not-computable`)             → the capture-flag fill (the quality payload).
 *   - not-applicable (`absent` /
 *     `aoi-not-present`)            → the neutral fill.
 *
 * When the cells are large enough (`layout.showCellValues`, the shared fit-gate
 * every matrix plot uses) the finite value is printed inside its cell in a
 * contrasting colour — the same behaviour the transition matrix / correlation
 * heatmap get from the default cell pass, which `drawCells` otherwise replaces.
 * NA cells print nothing: their distinct fill already says which bucket they are
 * (a shared `—` couldn't), and the tooltip states the exact reason.
 *
 * There is deliberately NO `colorScale[0]` fallback for NA cells — a missing
 * recording must never read as a low value. The grid + labels + hover +
 * gradient legend + PNG/JPG export are all inherited unchanged from the figure.
 */
export function createMetricMatrixCellRenderer(
  data: MetricMatrixData,
  colorScale: string[],
  range: [number, number],
  formatValue: (v: number) => string
) {
  const rowCount = data.rows.length
  const colCount = data.cols.length
  const [min, max] = range

  return (ctx: CanvasRenderingContext2D, layout: MatrixLayout) => {
    const { xOffset, yOffset, cellSize, showCellValues, cellValueFontSize } = layout
    if (showCellValues) {
      ctx.font = `${cellValueFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
    }
    for (let row = 0; row < rowCount; row++) {
      const rowBase = row * colCount
      for (let col = 0; col < colCount; col++) {
        const i = rowBase + col
        const st = data.state[i]
        const x = xOffset + col * cellSize
        const y = yOffset + row * cellSize
        let fill: string
        if (st === null) {
          fill = getColorForValue(data.values[i], min, max, colorScale)
        } else if (st === 'no-fixations' || st === 'not-computable') {
          fill = METRIC_MATRIX_NA_FLAG_COLOR
        } else {
          // 'absent' | 'aoi-not-present' → not-applicable neutral
          fill = METRIC_MATRIX_NA_NEUTRAL_COLOR
        }
        ctx.fillStyle = fill
        ctx.fillRect(x, y, cellSize, cellSize)
        // The value, only for finite cells and only when the layout says the
        // cells can fit text (matches the transition matrix / heatmap).
        if (showCellValues && st === null) {
          ctx.fillStyle = getContrastTextColor(fill)
          ctx.fillText(
            formatValue(data.values[i]),
            x + cellSize * 0.5,
            y + cellSize * 0.5 + 1
          )
        }
      }
    }
  }
}
