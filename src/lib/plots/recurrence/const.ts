import type {
  RecurrenceMethod,
  RecurrenceHighlight,
  RecurrenceMasking,
} from './types'

export const RECURRENCE_METHODS: {
  value: RecurrenceMethod
  label: string
}[] = [
  { value: 'fixedDistance', label: 'Fixed distance' },
  { value: 'fixedGrid', label: 'Fixed grid' },
  { value: 'aoi', label: 'AOI' },
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
}[] = [
  { value: 'none', label: 'None' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'diagonalLower', label: 'Diagonal + lower' },
]

export const RECURRENCE_LAYOUT = {
  leftMargin: 30,
  rightMargin: 10,
  topMargin: 0,
  bottomMargin: 0,
  axisTitleGap: 12,
  labelFontSize: 12,
  tickFontSize: 10,
  tickLength: 4,
  rqaFontSize: 11,
  rqaRowHeight: 22,
  minCellSize: 2,
  dotColor: '#1a56db',
  diagonalColor: '#e5e7eb',
  durationDotColor: '#3b82f6',
  gridLineColor: '#e5e7eb',
  gridBgColor: '#f9fafb',
  highlightDiagonal: '#e74c3c',
  highlightHorizontal: '#8e44ad',
  highlightVertical: '#0d9488',
  dimmedColor: '#9ca3af',
  dimmedAlpha: 0.15,
} as const
