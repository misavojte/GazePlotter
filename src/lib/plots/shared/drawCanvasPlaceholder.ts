/**
 * Standardized "empty state" copy. Each plot's figure paints this onto its
 * own canvas when the contracted metric resolution failed, so exports include
 * the message instead of rendering blank. Single-select plots use
 * METRIC_MISSING_MESSAGE; multi-select (metric-correlation) uses
 * METRIC_MISSING_MULTI_MESSAGE because "select a metric" is misleading when
 * the user actually needs ≥ 2.
 */
export const METRIC_MISSING_MESSAGE = 'Select a metric'
export const METRIC_MISSING_MULTI_MESSAGE = 'Select at least two metrics'

/**
 * Paints a centered "empty state" message onto a canvas. Used by every plot
 * when its selected metric instance has been deleted — the placeholder sits
 * on the canvas itself so exports include the message instead of rendering
 * a blank chart.
 */
export function drawCanvasPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  message: string,
): void {
  ctx.save()

  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#888'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '13px system-ui, -apple-system, sans-serif'
  ctx.fillText(message, width / 2, height / 2)
  ctx.restore()
}
