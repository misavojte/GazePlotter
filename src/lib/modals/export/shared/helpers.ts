import type { DecimalSeparator } from '$lib/data/export'
import { PLOT_HEADER_HEIGHT } from '$lib/plots/shared/const'
import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/plotSizeUtility'
import type { GridConfig } from '$lib/workspace/grid'

type SelectableOption<T extends string = string> = {
  value: T
  label: string
  sublabel?: string
}

type ExportButtonConfig = {
  canExport: boolean
  exportLabel: string
  isExporting: boolean
  onCancel: () => void
  onExport: () => void
  onOpenFormats?: () => void
  openFormatsLabel?: string
}

const EXPORT_UI_DELAY_MS = 100
export const DEFAULT_CANVAS_EXPORT_MARGIN = 20

type GridSizedFrame = {
  w: number
  h: number
}

export const CSV_DELIMITER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
]

export const CSV_DECIMAL_SEPARATOR_OPTIONS: Array<{
  value: DecimalSeparator
  label: string
}> = [
  { value: '.', label: 'Dot (.)' },
  { value: ',', label: 'Comma (,)' },
]

export function getWorkspaceCanvasExportDimensions(
  item: GridSizedFrame,
  gridConfig: GridConfig,
  margin: number = DEFAULT_CANVAS_EXPORT_MARGIN
) {
  const dimensions = calculatePlotDimensionsWithHeader(
    item.w,
    item.h,
    gridConfig,
    PLOT_HEADER_HEIGHT
  )

  const contentWidth = Math.max(1, Math.round(dimensions.width))
  const contentHeight = Math.max(1, Math.round(dimensions.height))
  const totalMargin = Math.max(0, Math.round(margin)) * 2

  return {
    width: contentWidth + totalMargin,
    height: contentHeight + totalMargin,
  }
}

export function waitForExportUi() {
  return new Promise(resolve => setTimeout(resolve, EXPORT_UI_DELAY_MS))
}

export function toggleSetValue<T>(
  values: ReadonlySet<T>,
  value: T,
  checked: boolean
) {
  const next = new Set(values)
  if (checked) next.add(value)
  else next.delete(value)
  return next
}

export function mapSelectableItems<T extends string>(
  options: readonly SelectableOption<T>[],
  selected: ReadonlySet<T>
) {
  return options.map(({ value, label, sublabel }) => ({
    key: value,
    label,
    sublabel,
    checked: selected.has(value),
  }))
}

export function createExportButtons({
  canExport,
  exportLabel,
  isExporting,
  onCancel,
  onExport,
}: ExportButtonConfig) {
  const buttons = [
    {
      label: isExporting ? 'Exporting...' : exportLabel,
      onclick: onExport,
      isDisabled: !canExport || isExporting,
      variant: 'primary' as const,
    },
    {
      label: 'Cancel',
      onclick: onCancel,
      isDisabled: false,
    },
  ]

  return buttons
}
