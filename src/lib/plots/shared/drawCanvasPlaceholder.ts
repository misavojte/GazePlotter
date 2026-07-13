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
const PLOT_CANNOT_FIT_HEIGHT_MESSAGE = 'The plot cannot fit the current height. Either:'
const PLOT_CANNOT_FIT_WIDTH_MESSAGE = 'The plot cannot fit the current width. Either:'
const PLOT_CANNOT_FIT_SIZE_MESSAGE = 'The plot cannot fit the current size. Either:'

export type PlotPlaceholderContent =
  | string
  | { message: string; steps?: string[]; kind?: 'warning' | 'error' }

/** Card palettes per placeholder kind. Bare strings render as 'warning'. */
const PLACEHOLDER_PALETTES = {
  warning: { bg: '#fffbe6', icon: '#faad14', text: '#855800' },
  error: { bg: '#fff2f0', icon: '#f5222d', text: '#a8071a' },
} as const

/**
 * Standard cannot-fit placeholder for `usePlot`'s `fit` guard: the axis picks
 * the message and the "extend the plot" first step; `extraSteps` add the
 * plot-specific remedies (merge AOIs, reduce participants, ...).
 */
export function cannotFitPlaceholder(
  axis: 'width' | 'height' | 'size',
  extraSteps: string[] = []
): PlotPlaceholderContent {
  const message =
    axis === 'width'
      ? PLOT_CANNOT_FIT_WIDTH_MESSAGE
      : axis === 'height'
        ? PLOT_CANNOT_FIT_HEIGHT_MESSAGE
        : PLOT_CANNOT_FIT_SIZE_MESSAGE
  const firstStep =
    axis === 'size'
      ? 'Extend the width or height of the plot'
      : `Extend the ${axis} of the plot`
  return { message, steps: [firstStep, ...extraSteps] }
}

/**
 * Paints a centered card/box with rounded corners (20px) and a triangle icon
 * onto the canvas. Used for all plot empty states, metrics missing, layout
 * failure, and render failure placeholders; `kind` picks the palette
 * (default 'warning').
 */
export function drawCanvasPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  message: PlotPlaceholderContent,
): void {
  const palette =
    PLACEHOLDER_PALETTES[
      (typeof message === 'object' ? message.kind : undefined) ?? 'warning'
    ]
  ctx.save()

  // Clear canvas so corners outside the rounded card are transparent
  ctx.clearRect(0, 0, width, height)

  const radius = 20 // Match grid item's rounded corners
  ctx.fillStyle = palette.bg
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, width, height, radius)
  } else {
    ctx.moveTo(radius, 0)
    ctx.arcTo(width, 0, width, height, radius)
    ctx.arcTo(width, height, 0, height, radius)
    ctx.arcTo(0, height, 0, 0, radius)
    ctx.arcTo(0, 0, width, 0, radius)
    ctx.closePath()
  }
  ctx.fill()

  let mainMessage: string
  let actionableSteps: string[] = []

  if (message && typeof message === 'object') {
    mainMessage = message.message
    actionableSteps = message.steps ?? []
  } else {
    mainMessage = message
  }

  const mainLines = mainMessage.split('\n')
  const stepLines = actionableSteps.map(step => `• ${step}`)

  const lineHeight = 18
  const mainTextHeight = mainLines.length * lineHeight
  const stepsGap = stepLines.length > 0 ? 7 : 0
  const stepsTextHeight = stepLines.length * lineHeight
  
  const iconSize = 32
  const contentHeight = iconSize + 12 + mainTextHeight + stepsGap + stepsTextHeight
  const startY = (height - contentHeight) / 2

  // Draw warning triangle icon
  const iconCenterX = width / 2
  const iconCenterY = startY + iconSize / 2
  
  ctx.beginPath()
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = palette.icon
  ctx.fillStyle = palette.icon
  
  const triHeight = iconSize * 0.866
  ctx.moveTo(iconCenterX, iconCenterY - triHeight / 2)
  ctx.lineTo(iconCenterX + iconSize / 2, iconCenterY + triHeight / 2)
  ctx.lineTo(iconCenterX - iconSize / 2, iconCenterY + triHeight / 2)
  ctx.closePath()
  ctx.stroke()
  ctx.fill()

  // Draw exclamation mark inside warning triangle
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('!', iconCenterX, iconCenterY + triHeight * 0.12)

  // Draw text
  ctx.fillStyle = palette.text
  ctx.font = '13px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  let currentY = startY + iconSize + 12
  for (const line of mainLines) {
    ctx.fillText(line, width / 2, currentY)
    currentY += lineHeight
  }

  if (stepLines.length > 0) {
    currentY += stepsGap
    for (const step of stepLines) {
      ctx.fillText(step, width / 2, currentY)
      currentY += lineHeight
    }
  }

  ctx.restore()
}

