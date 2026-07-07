import { describe, it, expect } from 'vitest'
import { SegmentWriter } from '$lib/data/ingest/kernel/segmentWriter'
import { encodeString, decodeBytes } from '$lib/data/ingest/utils/byteUtils'

const encUtf8 = (s: string) => encodeString(s, 'utf-8')
const encUtf16 = (s: string) => encodeString(s, 'utf-16le')

describe('encodeString — real UTF-8', () => {
  it('round-trips non-ASCII text through a UTF-8 TextDecoder', () => {
    const decoder = new TextDecoder('utf-8')
    for (const name of ['Účastník', 'Obrázek č. 1', 'Tvář', 'участник', '顔']) {
      expect(decodeBytes(encodeString(name, 'utf-8'), decoder)).toBe(name)
    }
  })

  it('matches the raw bytes a UTF-8 file would contain', () => {
    // Byte constants built from settings (e.g. Tobii stimulus base names)
    // are compared against file bytes — they must be identical for the
    // comparison to ever match.
    expect(Array.from(encodeString('č', 'utf-8'))).toEqual([0xc4, 0x8d])
  })

  it('round-trips non-ASCII text through UTF-16 decoders', () => {
    const le = new TextDecoder('utf-16le')
    const be = new TextDecoder('utf-16be')
    expect(decodeBytes(encodeString('Účastník', 'utf-16le'), le)).toBe(
      'Účastník'
    )
    expect(decodeBytes(encodeString('Účastník', 'utf-16be'), be)).toBe(
      'Účastník'
    )
  })
})

describe('SegmentWriter — name decoding is per-file, not last-file', () => {
  it('keeps non-ASCII stimulus/participant/AOI names intact', () => {
    const w = new SegmentWriter()
    w.setEncoding('utf-8')
    const fix = w.internCategory('Fixation')
    w.addSegmentBytes(0, 100, fix, encUtf8('Obrázek č. 1'), encUtf8('Účastník'), [
      encUtf8('Tvář'),
    ])

    const data = w.buildFinalData()
    expect(data.stimuli.data).toEqual([['Obrázek č. 1']])
    expect(data.participants.data).toEqual([['Účastník']])
    expect(data.aois.data[0][0].slice(0, 2)).toEqual(['Tvář', 'Tvář'])
  })

  it('decodes each file with its own encoding in a mixed-encoding upload', () => {
    const w = new SegmentWriter()
    const fix = w.internCategory('Fixation')

    // File 1: UTF-16LE — its names must survive the later encoding switch.
    w.setEncoding('utf-16le')
    w.addSegmentBytes(0, 100, fix, encUtf16('Scéna A'), encUtf16('Účastník 1'), [
      encUtf16('Oblast Ú'),
    ])

    // File 2: UTF-8.
    w.setEncoding('utf-8')
    w.addSegmentBytes(0, 100, fix, encUtf8('Scéna B'), encUtf8('Účastník 2'), [
      encUtf8('Oblast B'),
    ])

    const data = w.buildFinalData()
    expect(data.stimuli.data).toEqual([['Scéna A'], ['Scéna B']])
    expect(data.participants.data).toEqual([['Účastník 1'], ['Účastník 2']])
    expect(data.aois.data[0][0][0]).toBe('Oblast Ú')
    expect(data.aois.data[1][0][0]).toBe('Oblast B')
  })
})
