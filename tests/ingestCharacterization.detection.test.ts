/**
 * CHARACTERIZATION TESTS — ingest format detection.
 *
 * Phase 0 of the ingest v2 refactor. These tests pin the CURRENT observable
 * behavior of format classification so the refactor can prove 1:1 parity.
 * They intentionally cover the gaps `EyeClassifier.test.ts` leaves open:
 * Tobii (+ the `tobii-with-event` variant), Varjo, detection precedence on
 * ambiguous content, encoding detection from raw bytes, the German-CSV
 * delimiter heuristic, and the unknown-type failure mode.
 *
 * DO NOT "fix" surprising expectations here — they document behavior the
 * refactor must preserve. If a pinned behavior is genuinely a bug, change it
 * in a separate commit AFTER the refactor, with the pin updated deliberately.
 */

import { EyeClassifier } from '$lib/data/ingest/stream/Classifier'
import { test, expect, describe } from 'vitest'

const tobiiSlice = `Recording timestamp\tSensor\tParticipant name\tRecording name\tEye movement type\tGaze event duration\tAOI hit [Map_A - Region_1]
123\tEye Tracker\tP1\tRec 1\tFixation\t100\t1`

const tobiiWithEventSlice = `Recording timestamp\tSensor\tParticipant name\tEvent\tEye movement type\tGaze event duration
123\tEye Tracker\tP1\t\tFixation\t100`

const varjoSlice = `Time;Actor Label;Gaze Status
0.1;Wall;Valid`

describe('detection: formats not covered by EyeClassifier.test.ts', () => {
  test('tobii', () => {
    const sut = new EyeClassifier()
    expect(sut.classify(tobiiSlice)).toEqual({
      type: 'tobii',
      rowDelimiter: '\n',
      columnDelimiter: '\t',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('tobii with an Event column resolves to the tobii-with-event variant', () => {
    const sut = new EyeClassifier()
    expect(sut.classify(tobiiWithEventSlice)).toEqual({
      type: 'tobii-with-event',
      rowDelimiter: '\n',
      columnDelimiter: '\t',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('varjo', () => {
    const sut = new EyeClassifier()
    expect(sut.classify(varjoSlice)).toEqual({
      type: 'varjo',
      rowDelimiter: '\n',
      columnDelimiter: ';',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })
})

describe('detection precedence (order of checks is semantic)', () => {
  test('tobii beats varjo when markers of both are present', () => {
    const sut = new EyeClassifier()
    const ambiguous = `Recording timestamp\tTime\tActor Label\n1\t2\tWall`
    expect(sut.getTypeFromSlice(ambiguous)).toBe('tobii')
  })

  test('gazepoint beats varjo when markers of both are present', () => {
    const sut = new EyeClassifier()
    const ambiguous = `TIME(2021/07/13)\tActor Label\tFPOGS\tFPOGD\n0\tWall\t0\t0`
    expect(sut.getTypeFromSlice(ambiguous)).toBe('gazepoint')
  })

  test('begaze beats varjo when markers of both are present', () => {
    const sut = new EyeClassifier()
    const ambiguous = `Event Start Trial Time [ms]\tEvent End Trial Time [ms]\tTime\tActor Label`
    expect(sut.getTypeFromSlice(ambiguous)).toBe('begaze')
  })

  test('varjo beats the csv family (checked before csv even with csv columns present)', () => {
    const sut = new EyeClassifier()
    // Contains everything isCsv wants AND the Varjo markers; Varjo is
    // checked earlier in the chain and wins.
    const ambiguous = `Time,Participant,Stimulus,AOI,Actor Label\n0,P1,S1,A1,Wall`
    expect(sut.getTypeFromSlice(ambiguous)).toBe('varjo')
  })

  test('unknown content throws "Unknown file type"', () => {
    const sut = new EyeClassifier()
    expect(() => sut.classify('hello world\nfoo bar')).toThrow(
      'Unknown file type'
    )
    expect(sut.getTypeFromSlice('hello world\nfoo bar')).toBe('unknown')
  })
})

describe('detection: row delimiter and csv column-delimiter heuristics', () => {
  test('CRLF wins over LF; lone CR is recognized; LF is the default', () => {
    const sut = new EyeClassifier()
    const csvHeader = 'Time,Participant,Stimulus,AOI'
    expect(sut.classify(`${csvHeader}\r\n0,P1,S1,A1`).rowDelimiter).toBe('\r\n')
    expect(sut.classify(`${csvHeader}\n0,P1,S1,A1`).rowDelimiter).toBe('\n')
    expect(sut.classify(`${csvHeader}\r0,P1,S1,A1`).rowDelimiter).toBe('\r')
    expect(sut.classify(csvHeader).rowDelimiter).toBe('\n')
  })

  test('semicolon-delimited time-series CSV is NOT recognized (isCsv splits by comma only)', () => {
    // Characterized quirk: the plain-csv sniffer splits the header by ','
    // exclusively, so a German-style semicolon time-series CSV falls through
    // every check and classifies as unknown. Only the segmented-CSV variants
    // (whose sniffers use substring checks) reach the ';' delimiter branch.
    const sut = new EyeClassifier()
    const german = `Time;Participant;Stimulus;AOI\n0;P1;S1;A1`
    expect(sut.getTypeFromSlice(german)).toBe('unknown')
    expect(() => sut.classify(german)).toThrow('Unknown file type')
  })

  test('German-style segmented CSV (semicolons) IS recognized and gets ";"', () => {
    const sut = new EyeClassifier()
    const german = `From;To;Participant;Stimulus;AOI\n0;1;P1;S1;A1`
    expect(sut.classify(german)).toEqual(
      expect.objectContaining({ type: 'csv-segmented', columnDelimiter: ';' })
    )
  })

  test('tie between commas and semicolons resolves to ";" (strictly-more-commas wins)', () => {
    const sut = new EyeClassifier()
    // 2 commas and 2 semicolons in the header → counts equal → ';'
    const tie = `Time,Participant;Stimulus,AOI;X\n0,P1;S1,A1;9`
    expect(sut.determineCsvDelimiter(tie)).toBe(';')
  })
})

describe('detection from raw bytes (encoding sniffing)', () => {
  const csvText = 'Time,Participant,Stimulus,AOI\n0,P1,S1,A1'

  const utf8 = (s: string) => new TextEncoder().encode(s)

  const utf16le = (s: string, bom: boolean) => {
    const out = new Uint8Array((s.length + (bom ? 1 : 0)) * 2)
    let o = 0
    if (bom) {
      out[o++] = 0xff
      out[o++] = 0xfe
    }
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      out[o++] = c & 0xff
      out[o++] = (c >> 8) & 0xff
    }
    return out
  }

  const utf16be = (s: string, bom: boolean) => {
    const out = new Uint8Array((s.length + (bom ? 1 : 0)) * 2)
    let o = 0
    if (bom) {
      out[o++] = 0xfe
      out[o++] = 0xff
    }
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      out[o++] = (c >> 8) & 0xff
      out[o++] = c & 0xff
    }
    return out
  }

  test('plain utf-8 bytes', () => {
    const sut = new EyeClassifier()
    const settings = sut.classifyFromBytes(utf8(csvText))
    expect(settings.encoding).toBe('utf-8')
    expect(settings.type).toBe('csv')
  })

  test('utf-8 BOM is stripped before classification', () => {
    const sut = new EyeClassifier()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const bytes = new Uint8Array([...bom, ...utf8(csvText)])
    const settings = sut.classifyFromBytes(bytes)
    expect(settings.encoding).toBe('utf-8')
    expect(settings.type).toBe('csv')
  })

  test('utf-16le with BOM', () => {
    const sut = new EyeClassifier()
    const settings = sut.classifyFromBytes(utf16le(csvText, true))
    expect(settings.encoding).toBe('utf-16le')
    expect(settings.type).toBe('csv')
  })

  test('utf-16le WITHOUT BOM via the null-byte-position heuristic', () => {
    const sut = new EyeClassifier()
    const settings = sut.classifyFromBytes(utf16le(csvText, false))
    expect(settings.encoding).toBe('utf-16le')
    expect(settings.type).toBe('csv')
  })

  test('utf-16be with BOM', () => {
    const sut = new EyeClassifier()
    const settings = sut.classifyFromBytes(utf16be(csvText, true))
    expect(settings.encoding).toBe('utf-16be')
    expect(settings.type).toBe('csv')
  })
})
