import type { DecimalSeparator, ExportNaming } from '$lib/data/export'
import { PLOT_BASE_CHROME_HEIGHT } from '$lib/plots/shared/const'
import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/plotSizeUtility'
import type { GridConfig } from '$lib/workspace/grid'

type SelectableOption<T extends string = string> = {
  value: T
  label: string
  sublabel?: string
  disabled?: boolean
  /** Shown next to the sublabel when the item is disabled — says WHY. */
  reason?: string
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

export const EXPORT_NAMING_OPTIONS: Array<{
  value: ExportNaming
  label: string
}> = [
  { value: 'displayed', label: 'Displayed (grouped, renamed)' },
  { value: 'raw', label: 'Raw (original imported)' },
]

export const EXPORT_TYPE_OPTIONS = [
  { value: 'csv', label: 'Single CSV File' },
  { value: 'individual-csv', label: 'Individual CSV Files (Zipped)' },
]

/** Collapsed-header parts for the CSV file step: export type + naming mode. */
export function exportTypeNamingSummary(
  exportType: string,
  naming: ExportNaming
): string[] {
  return [
    exportType === 'csv' ? 'Single CSV' : 'Individual CSVs',
    naming === 'displayed' ? 'displayed names' : 'raw names',
  ]
}

export function getWorkspaceCanvasExportDimensions(
  item: GridSizedFrame,
  gridConfig: GridConfig,
  margin: number = DEFAULT_CANVAS_EXPORT_MARGIN
) {
  // Mirror BasePlot's headerless sizing: every plot now renders without an
  // inline header, so the figure reclaims only the base chrome (grid-item
  // header + body padding + frame border), not the legacy inline-header
  // reserve. Keeps the default export aspect ratio matching the screen.
  const dimensions = calculatePlotDimensionsWithHeader(
    item.w,
    item.h,
    gridConfig,
    PLOT_BASE_CHROME_HEIGHT
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

/**
 * One-line selection readout for a collapsed step header: `None selected`,
 * `All (5)`, the single selected item's name, or `3 of 12`.
 */
export function listSummary(count: number, total: number, single?: string): string {
  if (count === 0) return 'None selected'
  if (count === total && total > 0) return `All (${total})`
  if (count === 1 && single) return single
  return `${count} of ${total}`
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
  return options.map(({ value, label, sublabel, disabled, reason }) => ({
    key: value,
    label,
    sublabel,
    checked: selected.has(value),
    disabled,
    reason,
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
