/**
 * CHARACTERIZATION TESTS — ingest format detection.
 *
 * Phase 0 of the ingest v2 refactor pinned the old `EyeClassifier`
 * behavior; this file now drives the SAME assertions through the v2
 * registry (`classifyProbe` / `detectTypeId` over a `SourceProbe`).
 * The expected objects are unchanged from the pre-refactor pins — they
 * prove the registry classifies 1:1 with the deleted classifier.
 * (Also absorbs the classification pins of the old EyeClassifier.test.ts.)
 *
 * DO NOT "fix" surprising expectations here — they document behavior the
 * registry must preserve. If a pinned behavior is genuinely a bug, change
 * it in a separate commit, with the pin updated deliberately.
 */

import { probeFromBytes, probeFromText } from '$lib/data/ingest/kernel/source'
import {
  classifyProbe,
  detectTypeId,
} from '$lib/data/ingest/formats/registry'
import { determineCsvDelimiter } from '$lib/data/ingest/formats/lib/rows/csvDelimiter'
import { test, expect, describe } from 'vitest'

const classify = (slice: string) => classifyProbe(probeFromText(slice))
const detect = (slice: string) => detectTypeId(probeFromText(slice))

const tobiiSlice = `Recording timestamp\tSensor\tParticipant name\tRecording name\tEye movement type\tGaze event duration\tAOI hit [Map_A - Region_1]
123\tEye Tracker\tP1\tRec 1\tFixation\t100\t1`

const tobiiWithEventSlice = `Recording timestamp\tSensor\tParticipant name\tEvent\tEye movement type\tGaze event duration
123\tEye Tracker\tP1\t\tFixation\t100`

const varjoSlice = `Time;Actor Label;Gaze Status
0.1;Wall;Valid`

const beGazeSlice = `Event Start Trial Time [ms],Event End Trial Time [ms],Stimulus,Participant,Category,AOI Name
0,100,Map_A,Participant_1,Fixation,Region_1`

const gazePointSlice = `MEDIA_ID,MEDIA_NAME,TIME(2021/07/13 09:21:09.801),FPOGS,FPOGD,FPOGID,BKID,BKDUR,AOI
0,Slide0,0.06689,0.00000,0.06689,1,0,0.00000,,`

const ogamaSlice = `# Contents: Similarity Measurements of scanpaths.
#
#
#
#
#
Sequence Similarity,Scanpath string
Participant_1,ABCD`

const csvSlice =
  'Time,Participant,Stimulus,AOI\r\n0,Participant_1,Map_A,Region_1\r\n1,Participant_1,Map_A,Region_1'

const csvSegmentedSlice =
  'From,To,Participant,Stimulus,AOI\r\n0,1,Participant_1,Map_A,Region_1\r\n1,2,Participant_1,Map_A,Region_1'

const csvSegmentedDurationSlice =
  'stimulus,participant,timestamp,duration,eyemovementtype,AOI\r\nSMI Base,Anna,226.2,72,1,\r\nSMI Base,Anna,298.2,120,0,Map'

describe('detection: classification settings per format', () => {
  test('tobii', () => {
    expect(classify(tobiiSlice)).toEqual({
      type: 'tobii',
      rowDelimiter: '\n',
      columnDelimiter: '\t',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('tobii with an Event column resolves to the tobii-with-event variant', () => {
    expect(classify(tobiiWithEventSlice)).toEqual({
      type: 'tobii-with-event',
      rowDelimiter: '\n',
      columnDelimiter: '\t',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('varjo', () => {
    expect(classify(varjoSlice)).toEqual({
      type: 'varjo',
      rowDelimiter: '\n',
      columnDelimiter: ';',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('begaze', () => {
    expect(classify(beGazeSlice)).toEqual({
      type: 'begaze',
      rowDelimiter: '\n',
      columnDelimiter: '\t',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('gazepoint', () => {
    expect(classify(gazePointSlice)).toEqual({
      type: 'gazepoint',
      rowDelimiter: '\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('ogama (header on row 8)', () => {
    expect(classify(ogamaSlice)).toEqual({
      type: 'ogama',
      rowDelimiter: '\n',
      columnDelimiter: '\t',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 8,
    })
  })

  test('csv (continuous time series)', () => {
    expect(classify(csvSlice)).toEqual({
      type: 'csv',
      rowDelimiter: '\r\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('csv-segmented (From/To columns)', () => {
    expect(classify(csvSegmentedSlice)).toEqual({
      type: 'csv-segmented',
      rowDelimiter: '\r\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('csv-segmented-duration (timestamp + duration)', () => {
    expect(classify(csvSegmentedDurationSlice)).toEqual({
      type: 'csv-segmented-duration',
      rowDelimiter: '\r\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
  })
})

describe('detection precedence (registry order is semantic)', () => {
  test('tobii beats varjo when markers of both are present', () => {
    const ambiguous = `Recording timestamp\tTime\tActor Label\n1\t2\tWall`
    expect(detect(ambiguous)).toBe('tobii')
  })

  test('gazepoint beats varjo when markers of both are present', () => {
    const ambiguous = `TIME(2021/07/13)\tActor Label\tFPOGS\tFPOGD\n0\tWall\t0\t0`
    expect(detect(ambiguous)).toBe('gazepoint')
  })

  test('begaze beats varjo when markers of both are present', () => {
    const ambiguous = `Event Start Trial Time [ms]\tEvent End Trial Time [ms]\tTime\tActor Label`
    expect(detect(ambiguous)).toBe('begaze')
  })

  test('varjo beats the csv family (checked before csv even with csv columns present)', () => {
    const ambiguous = `Time,Participant,Stimulus,AOI,Actor Label\n0,P1,S1,A1,Wall`
    expect(detect(ambiguous)).toBe('varjo')
  })

  test('more specific csv variants win: duration before From/To before plain', () => {
    expect(detect(csvSegmentedDurationSlice)).toBe('csv-segmented-duration')
    expect(detect(csvSegmentedSlice)).toBe('csv-segmented')
    expect(detect(csvSlice)).toBe('csv')
  })

  test('unknown content throws "Unknown file type"', () => {
    expect(() => classify('hello world\nfoo bar')).toThrow('Unknown file type')
    expect(detect('hello world\nfoo bar')).toBe('unknown')
  })
})

describe('detection: row delimiter and csv column-delimiter heuristics', () => {
  test('CRLF wins over LF; lone CR is recognized; LF is the default', () => {
    const csvHeader = 'Time,Participant,Stimulus,AOI'
    expect(classify(`${csvHeader}\r\n0,P1,S1,A1`).rowDelimiter).toBe('\r\n')
    expect(classify(`${csvHeader}\n0,P1,S1,A1`).rowDelimiter).toBe('\n')
    expect(classify(`${csvHeader}\r0,P1,S1,A1`).rowDelimiter).toBe('\r')
    expect(classify(csvHeader).rowDelimiter).toBe('\n')
  })

  test('semicolon-delimited time-series CSV is NOT recognized (sniff splits by comma only)', () => {
    // Characterized quirk: the plain-csv sniffer splits the header by ','
    // exclusively, so a German-style semicolon time-series CSV falls through
    // every check and classifies as unknown. Only the segmented-CSV variants
    // (whose sniffers use substring checks) reach the ';' delimiter branch.
    const german = `Time;Participant;Stimulus;AOI\n0;P1;S1;A1`
    expect(detect(german)).toBe('unknown')
    expect(() => classify(german)).toThrow('Unknown file type')
  })

  test('German-style segmented CSV (semicolons) IS recognized and gets ";"', () => {
    const german = `From;To;Participant;Stimulus;AOI\n0;1;P1;S1;A1`
    expect(classify(german)).toEqual(
      expect.objectContaining({ type: 'csv-segmented', columnDelimiter: ';' })
    )
  })

  test('tie between commas and semicolons resolves to ";" (strictly-more-commas wins)', () => {
    // 2 commas and 2 semicolons in the header → counts equal → ';'
    const tie = `Time,Participant;Stimulus,AOI;X\n0,P1;S1,A1;9`
    expect(determineCsvDelimiter(probeFromText(tie))).toBe(';')
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
    const settings = classifyProbe(probeFromBytes('a.csv', utf8(csvText)))
    expect(settings.encoding).toBe('utf-8')
    expect(settings.type).toBe('csv')
  })

  test('utf-8 BOM is stripped before classification', () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const bytes = new Uint8Array([...bom, ...utf8(csvText)])
    const settings = classifyProbe(probeFromBytes('a.csv', bytes))
    expect(settings.encoding).toBe('utf-8')
    expect(settings.type).toBe('csv')
  })

  test('utf-16le with BOM', () => {
    const settings = classifyProbe(
      probeFromBytes('a.csv', utf16le(csvText, true))
    )
    expect(settings.encoding).toBe('utf-16le')
    expect(settings.type).toBe('csv')
  })

  test('utf-16le WITHOUT BOM via the null-byte-position heuristic', () => {
    const settings = classifyProbe(
      probeFromBytes('a.csv', utf16le(csvText, false))
    )
    expect(settings.encoding).toBe('utf-16le')
    expect(settings.type).toBe('csv')
  })

  test('utf-16be with BOM', () => {
    const settings = classifyProbe(
      probeFromBytes('a.csv', utf16be(csvText, true))
    )
    expect(settings.encoding).toBe('utf-16be')
    expect(settings.type).toBe('csv')
  })
})
