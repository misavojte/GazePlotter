import type { DecimalSeparator } from '$lib/data/export'

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
  onOpenFormats: () => void
}

const EXPORT_UI_DELAY_MS = 100

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
  onOpenFormats,
}: ExportButtonConfig) {
  return [
    {
      label: isExporting ? 'Exporting...' : exportLabel,
      onclick: onExport,
      isDisabled: !canExport || isExporting,
      variant: 'primary' as const,
    },
    {
      label: 'All Data Formats',
      onclick: onOpenFormats,
      isDisabled: false,
    },
    {
      label: 'Cancel',
      onclick: onCancel,
      isDisabled: false,
    },
  ]
}
