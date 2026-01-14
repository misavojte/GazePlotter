export type DecimalSeparator = ',' | '.'

export type CsvFormatOptions = {
  delimiter?: string
  decimalSeparator?: DecimalSeparator
}

export function resolveCsvFormatOptions(
  options?: CsvFormatOptions
): Required<CsvFormatOptions> {
  return {
    delimiter: options?.delimiter ?? ',',
    decimalSeparator: options?.decimalSeparator ?? '.',
  }
}

export function formatNumberForCsv(
  value: unknown,
  decimalSeparator: DecimalSeparator = '.'
): string {
  if (value === null || value === undefined) return ''

  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return ''

  const stringValue = num.toString()
  return decimalSeparator === ','
    ? stringValue.replace(/\./g, ',')
    : stringValue
}

export function escapeCsvField(
  value: unknown,
  delimiter: string = ','
): string {
  const raw = value ?? ''
  const stringValue = typeof raw === 'string' ? raw : String(raw)
  const needsEscaping =
    stringValue.includes(delimiter) ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  const escaped = stringValue.replace(/"/g, '""')
  return needsEscaping ? `"${escaped}"` : stringValue
}
