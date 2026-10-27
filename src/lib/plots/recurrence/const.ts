import type {
  RecurrenceMethod,
  RecurrenceHighlight,
  RecurrenceMasking,
} from './types'

export const RECURRENCE_METHODS: {
  value: RecurrenceMethod
  label: string
  detail: string
}[] = [
  { value: 'fixedDistance', label: 'Fixed distance', detail: 'Recurrent within a radius' },
  { value: 'fixedGrid', label: 'Fixed grid', detail: 'Recurrent in the same grid cell' },
  { value: 'aoi', label: 'AOI', detail: 'Recurrent on a shared AOI' },
]

export const RECURRENCE_HIGHLIGHTS: {
  value: RecurrenceHighlight
  label: string
}[] = [
  { value: 'none', label: 'None' },
  { value: 'diagonal', label: 'Diagonal lines' },
  { value: 'horizontal', label: 'Horizontal lines' },
  { value: 'vertical', label: 'Vertical lines' },
]

export const RECURRENCE_MASKINGS: {
  value: RecurrenceMasking
  label: string
  detail: string
}[] = [
  { value: 'none', label: 'None', detail: 'Every cell drawn' },
  { value: 'diagonal', label: 'Diagonal', detail: 'Main diagonal hidden' },
  { value: 'diagonalLower', label: 'Diagonal + lower', detail: 'Only the upper triangle drawn' },
]

export const RECURRENCE_LAYOUT = {
  /** Tick count per axis (nice whole-number steps). */
  tickCount: 5,
  /** Upper bound on a recurrent dot's radius (px); below it the radius is a
      share of the fixation spacing. */
  maxDotRadius: 5,
  /** Dot radius as a share of the spacing between neighbouring fixations. */
  dotSpacingRatio: 0.45,
  /** Top/right inset (px): fixation n sits ON the border, so its dot, the
      mirrored ticks and the label at the axis end need room inside the canvas. */
  edgePadPx: 7,
  dotColor: '#1a56db',
  diagonalColor: '#e5e7eb',
  highlightDiagonal: '#e74c3c',
  highlightHorizontal: '#8e44ad',
  highlightVertical: '#0d9488',
  dimmedColor: '#9ca3af',
  dimmedAlpha: 0.15,
} as const
