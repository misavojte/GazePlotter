import { describe, expect, it } from 'vitest'
import {
  EXPORT_MEMORY_DEFAULTS,
  readExportMemory,
  rememberExport,
} from '$lib/modals/export/shared/exportMemory'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

describe('export memory', () => {
  it('starts from the defaults', () => {
    expect(readExportMemory(memoryStorage())).toEqual(EXPORT_MEMORY_DEFAULTS)
    expect(readExportMemory(null)).toEqual(EXPORT_MEMORY_DEFAULTS)
  })

  it('keeps each dialog\'s choices without losing the others', () => {
    const storage = memoryStorage()
    rememberExport({ delimiter: ';', decimalSeparator: ',' }, storage)
    rememberExport({ metricFormat: 'wide', includeCodebook: false }, storage)
    rememberExport({ figureFileType: '.jpg', figureDpi: 600, figureMargin: 0 }, storage)
    expect(readExportMemory(storage)).toEqual({
      delimiter: ';',
      decimalSeparator: ',',
      metricFormat: 'wide',
      includeCodebook: false,
      figureFileType: '.jpg',
      figureDpi: 600,
      figureMargin: 0,
    })
  })

  it('replaces only the invalid fields with defaults', () => {
    const storage = memoryStorage({
      'gazeplotter.exportMemory': JSON.stringify({
        delimiter: '|',
        metricFormat: 'wide',
        figureDpi: 10,
        includeCodebook: 'yes',
      }),
    })
    expect(readExportMemory(storage)).toEqual({
      ...EXPORT_MEMORY_DEFAULTS,
      metricFormat: 'wide',
    })
  })

  it('survives unreadable and unwritable storage', () => {
    const broken = memoryStorage({ 'gazeplotter.exportMemory': '{not json' })
    expect(readExportMemory(broken)).toEqual(EXPORT_MEMORY_DEFAULTS)
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => rememberExport({ delimiter: ';' }, full)).not.toThrow()
  })
})
