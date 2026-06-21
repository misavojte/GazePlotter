import { describe, it, expect } from 'vitest'
import { SegmentWriter } from '$lib/data/ingest/kernel/segmentWriter'
import { encodeString } from '$lib/data/ingest/utils/byteUtils'

const enc = (s: string) => encodeString(s, 'utf-8')

function writer() {
  const w = new SegmentWriter()
  w.setEncoding('utf-8')
  return w
}

describe('SegmentWriter — data-derived categories', () => {
  it('emits only Fixation for a fixation-only dataset (no phantom Saccade)', () => {
    const w = writer()
    const fix = w.internCategory('Fixation')
    w.addSegmentBytes(0, 100, fix, enc('S1'), enc('P1'), null)
    w.addSegmentBytes(100, 200, fix, enc('S1'), enc('P1'), null)

    expect(w.buildFinalData().categories.data).toEqual([['Fixation']])
  })

  it('preserves distinct source types as separate categories (Tobii-like)', () => {
    const w = writer()
    const fix = w.internCategory('Fixation')
    const sac = w.internCategory('Saccade')
    const unc = w.internCategory('Unclassified')
    const enf = w.internCategory('EyesNotFound')
    w.addSegmentBytes(0, 100, fix, enc('S1'), enc('P1'), null)
    w.addSegmentBytes(100, 110, sac, enc('S1'), enc('P1'), null)
    w.addSegmentBytes(110, 120, unc, enc('S1'), enc('P1'), null)
    w.addSegmentBytes(120, 130, enf, enc('S1'), enc('P1'), null)

    expect(w.buildFinalData().categories.data).toEqual([
      ['Fixation'],
      ['Saccade'],
      ['Unclassified'],
      ['EyesNotFound'],
    ])
  })

  it('labels a non-fixation type by its real name (GazePoint Blink, not Saccade)', () => {
    const w = writer()
    const fix = w.internCategory('Fixation')
    const blink = w.internCategory('Blink')
    w.addSegmentBytes(0, 100, fix, enc('S1'), enc('P1'), null)
    w.addSegmentBytes(100, 140, blink, enc('S1'), enc('P1'), null)

    expect(w.buildFinalData().categories.data).toEqual([
      ['Fixation'],
      ['Blink'],
    ])
  })

  it('reserves Fixation at id 0 even when it is interned after another type', () => {
    const w = writer()
    // A saccade segment arrives first; Fixation must still be id 0.
    const sac = w.internCategory('Saccade')
    w.addSegmentBytes(0, 50, sac, enc('S1'), enc('P1'), null)
    const fix = w.internCategory('Fixation')
    w.addSegmentBytes(50, 150, fix, enc('S1'), enc('P1'), null)

    expect(fix).toBe(0)
    expect(sac).toBe(1)
    expect(w.buildFinalData().categories.data).toEqual([
      ['Fixation'],
      ['Saccade'],
    ])
  })

  it('coalesces a type name regardless of source encoding (interner keyed by string)', () => {
    // RowParser.resolveCategoryId decodes per-file bytes to a string before
    // interning, so a UTF-16 file and a UTF-8 file in one upload both resolve
    // "Fixation" to id 0 — never a second, encoding-specific Fixation entry.
    const w = writer()
    // Re-encoding the encoding stays per-file in the real flow; here we assert
    // the writer's identity is the string, not the bytes.
    w.setEncoding('utf-16le')
    const fixA = w.internCategory('Fixation')
    w.setEncoding('utf-8')
    const fixB = w.internCategory('Fixation')
    expect(fixA).toBe(0)
    expect(fixB).toBe(0)
    w.addSegmentBytes(0, 100, fixB, enc('S1'), enc('P1'), null)
    expect(w.buildFinalData().categories.data).toEqual([['Fixation']])
  })
})
