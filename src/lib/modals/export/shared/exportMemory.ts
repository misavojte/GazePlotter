import type { DecimalSeparator } from '$lib/data/export'
import type { ExportFileType } from '$lib/plots/shared/figureExport'
import { DEFAULT_CANVAS_EXPORT_MARGIN } from './helpers'

/**
 * The export dialogs' last choices, kept in this browser across reloads: set
 * when an export starts, read when a dialog opens. Blocked or corrupt storage
 * falls back to the defaults, one field at a time.
 */
export interface ExportMemory {
  delimiter: string
  decimalSeparator: DecimalSeparator
  metricFormat: 'long' | 'wide'
  includeCodebook: boolean
  figureFileType: ExportFileType
  figureDpi: number
  figureMargin: number
}

export const EXPORT_MEMORY_DEFAULTS: ExportMemory = {
  delimiter: ',',
  decimalSeparator: '.',
  metricFormat: 'long',
  includeCodebook: true,
  figureFileType: '.png',
  figureDpi: 300,
  figureMargin: DEFAULT_CANVAS_EXPORT_MARGIN,
}

const STORAGE_KEY = 'gazeplotter.exportMemory'

type MemoryStorage = Pick<Storage, 'getItem' | 'setItem'>

const VALID: { [K in keyof ExportMemory]: (value: unknown) => boolean } = {
  delimiter: value => value === ',' || value === ';',
  decimalSeparator: value => value === '.' || value === ',',
  metricFormat: value => value === 'long' || value === 'wide',
  includeCodebook: value => typeof value === 'boolean',
  figureFileType: value => value === '.png' || value === '.jpg',
  figureDpi: value => typeof value === 'number' && Number.isFinite(value) && value >= 72,
  figureMargin: value => typeof value === 'number' && Number.isFinite(value) && value >= 0,
}

function browserStorage(): MemoryStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readExportMemory(
  storage: MemoryStorage | null = browserStorage()
): ExportMemory {
  let stored: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}')
    if (parsed && typeof parsed === 'object') stored = parsed as Record<string, unknown>
  } catch {
    // Unreadable: every field takes its default.
  }
  const memory = { ...EXPORT_MEMORY_DEFAULTS }
  for (const key of Object.keys(VALID) as Array<keyof ExportMemory>) {
    if (VALID[key](stored[key])) (memory as Record<string, unknown>)[key] = stored[key]
  }
  return memory
}

export function rememberExport(
  choices: Partial<ExportMemory>,
  storage: MemoryStorage | null = browserStorage()
): void {
  try {
    storage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readExportMemory(storage), ...choices })
    )
  } catch {
    // Full or blocked storage: the export itself goes ahead.
  }
}
