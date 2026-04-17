import type {
  MetricCorrelationResult,
  MetricCorrelationSettings,
} from '../types'

/**
 * Long-format CSV: one row per metric pair. Scope (AOI name or "Whole
 * stimulus") and method are included so external analyses can distinguish
 * exports from different plot instances in the same session.
 */
export function buildCorrelationCsv(
  result: MetricCorrelationResult,
  _settings: MetricCorrelationSettings
): string {
  const header = [
    'metric_a',
    'metric_b',
    'r',
    'n',
    'method',
    'scope',
  ]

  const metricLabel = new Map<string, string>()
  for (const m of result.metrics) metricLabel.set(m.id, m.label)

  const rows: string[] = []
  rows.push(header.join(','))

  for (const cell of result.cells) {
    if (cell.rowMetricId === cell.colMetricId) continue
    const row = [
      csvField(metricLabel.get(cell.rowMetricId) ?? cell.rowMetricId),
      csvField(metricLabel.get(cell.colMetricId) ?? cell.colMetricId),
      cell.r === null ? '' : cell.r.toFixed(6),
      String(cell.n),
      result.correlationMethod,
      csvField(result.scope.label),
    ]
    rows.push(row.join(','))
  }

  return rows.join('\n') + '\n'
}

export function downloadCorrelationCsv(
  result: MetricCorrelationResult,
  settings: MetricCorrelationSettings
): void {
  if (typeof document === 'undefined') return
  const csv = buildCorrelationCsv(result, settings)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const scopeSlug = result.scope.label.replace(/[^A-Za-z0-9_-]+/g, '_')
  const filename = `GazePlotter-MetricCorrelations-${result.correlationMethod}-${scopeSlug}.csv`
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function csvField(value: string): string {
  if (value === '') return ''
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
