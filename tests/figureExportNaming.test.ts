import { describe, it, expect } from 'vitest'
import { sanitizeFileName } from '../src/lib/data/export/download'
import { buildFigureEntryName } from '../src/lib/modals/export/export-figures/naming'

describe('sanitizeFileName', () => {
  it('strips path separators and reserved characters', () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe(
      'a b c d e f g h i j'
    )
  })

  it('strips control characters', () => {
    expect(sanitizeFileName('a\u0000b\u001fc\td')).toBe('a b c d')
  })

  it('collapses whitespace and trims', () => {
    expect(sanitizeFileName('  AOI   Comparison  ')).toBe('AOI Comparison')
  })

  it('falls back when nothing survives', () => {
    expect(sanitizeFileName('///')).toBe('untitled')
    expect(sanitizeFileName('')).toBe('untitled')
  })

  it('keeps ordinary names untouched', () => {
    expect(sanitizeFileName('Scarf Plot - SMI Base')).toBe(
      'Scarf Plot - SMI Base'
    )
  })
})

describe('buildFigureEntryName', () => {
  it('prefixes the workspace position, zero-padded to two digits', () => {
    expect(
      buildFigureEntryName({
        position: 3,
        total: 9,
        name: 'AOI Comparison',
        qualifiers: [],
        extension: '.png',
      })
    ).toBe('03 AOI Comparison.png')
  })

  it('widens the padding for batches of 100 or more', () => {
    expect(
      buildFigureEntryName({
        position: 7,
        total: 120,
        name: 'Scarf Plot',
        qualifiers: [],
        extension: '.jpg',
      })
    ).toBe('007 Scarf Plot.jpg')
  })

  it('appends subtitle qualifiers to disambiguate same-type plots', () => {
    expect(
      buildFigureEntryName({
        position: 1,
        total: 2,
        name: 'Scarf Plot',
        qualifiers: ['SMI Base', 'All Participants'],
        extension: '.png',
      })
    ).toBe('01 Scarf Plot - SMI Base, All Participants.png')
  })

  it('skips blank qualifiers', () => {
    expect(
      buildFigureEntryName({
        position: 1,
        total: 1,
        name: 'Scanpath',
        qualifiers: ['', '  '],
        extension: '.png',
      })
    ).toBe('01 Scanpath.png')
  })

  it('sanitizes unsafe characters coming from user-named entities', () => {
    expect(
      buildFigureEntryName({
        position: 2,
        total: 2,
        name: 'AOI Timeline',
        qualifiers: ['trial/1: "warm-up"'],
        extension: '.png',
      })
    ).toBe('02 AOI Timeline - trial 1 warm-up.png')
  })
})
