/**
 * The one-pass row scanner (rowScan.ts) against a deliberately naive
 * reference (helpers/referenceRowScan.ts): every row's needed cells and AOI
 * hits must match for any content, encoding, row ending, delimiter and
 * chunking. Plus: the same file in any encoding / row ending imports to the
 * same dataset.
 */

import { describe, expect, test } from 'vitest'
import { RowParser } from '$lib/data/ingest/formats/lib/rows/RowParser'
import type { RowEnd } from '$lib/data/ingest/formats/lib/rows/rowScan'
import { encodeString, type TextEncoding } from '$lib/data/ingest/utils/byteUtils'
import { IngestJob } from '$lib/data/ingest/kernel/job'
import { streamSource } from '$lib/data/ingest/kernel/source'
import { FORMAT_REGISTRY } from '$lib/data/ingest/formats/registry'
import { testMobileTsvData } from './TobiiRowParser.test.data'
import { referenceRowScan, type ReferenceRow } from './helpers/referenceRowScan'

/** Records every packed cell and the AOI hits of each row. */
class ProbeParser extends RowParser {
  readonly rows: string[] = []
  private readonly decoder: TextDecoder

  constructor(
    delimiter: string,
    encoding: TextEncoding,
    columns: number[],
    aoiStart: number,
    aoiCount: number
  ) {
    super(delimiter, encoding)
    this.decoder = new TextDecoder(encoding)
    this.setupColumns(columns)
    if (aoiCount > 0) this.setupAoiColumns(aoiStart, aoiCount)
  }

  protected override deserializeFromBytes(): void {
    const cells: string[] = []
    for (let p = 0; p < this.columnMap.length; p++) {
      cells.push(this.decoder.decode(this.getBytes(p)) + '#' + this.cellLength(p))
    }
    const hits = Array.from(
      this.aoiHits.subarray(this.aoiHitStart, this.aoiHitStart + this.aoiHitLen)
    )
    this.rows.push(cells.join('|') + ' H=' + hits.join(','))
  }

  finalize(): void {}
}

/** The probe line the reference predicts for one row. */
function expectedLine(
  bytes: Uint8Array,
  row: ReferenceRow,
  encoding: TextEncoding,
  columns: number[],
  aoiStart: number,
  aoiCount: number
): string {
  const decoder = new TextDecoder(encoding)
  const unit = encoding === 'utf-8' ? 1 : 2
  const cells = columns.map(c => {
    const cell = c >= 0 ? row.cells[c] : undefined
    if (!cell) return '#0'
    return decoder.decode(bytes.subarray(cell.start, cell.end)) + '#' + (cell.end - cell.start)
  })
  const hits: number[] = []
  for (let k = 0; k < aoiCount; k++) {
    const cell = row.cells[aoiStart + k]
    if (cell && cell.end - cell.start === unit && decoder.decode(bytes.subarray(cell.start, cell.end)) === '1') {
      hits.push(k)
    }
  }
  return cells.join('|') + ' H=' + hits.join(',')
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random chunking, including odd sizes that split UTF-16 code units. */
function chunked(bytes: Uint8Array, rand: () => number): Uint8Array[] {
  const out: Uint8Array[] = []
  for (let i = 0; i < bytes.length; ) {
    const size = rand() < 0.5 ? 1 + Math.floor(rand() * 40) : 1 + Math.floor(rand() * 5000)
    out.push(bytes.slice(i, i + size))
    i += size
  }
  return out
}

const ROW_DELIMITER: Record<Exclude<RowEnd, 'none'>, string> = { lf: '\n', crlf: '\r\n', cr: '\r' }

function viaFeed(probe: ProbeParser, rowEnd: Exclude<RowEnd, 'none'>, chunks: Uint8Array[]) {
  const feed = probe.openRowScanFeed(ROW_DELIMITER[rowEnd])
  for (const chunk of chunks) feed.push(chunk)
  feed.finish()
}

describe('the row scanner equals the naive reference', () => {
  test('fuzz: encodings, row ends, delimiters, AOI blocks, chunking', () => {
    const encodings: TextEncoding[] = ['utf-8', 'utf-16le', 'utf-16be']
    const rowEnds = ['lf', 'crlf', 'cr'] as const
    for (let seed = 1; seed <= 300; seed++) {
      const rand = mulberry32(seed)
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
      const encoding = pick(encodings)
      const rowEnd = pick(rowEnds)
      const delimiter = pick([',', '\t', ';'])
      const width = 1 + Math.floor(rand() * 60)

      // AOI block: none, small, or wide (exercises the word skip).
      const aoiCount = rand() < 0.25 ? 0 : 1 + Math.floor(rand() * Math.min(width, 50))
      const aoiStart = aoiCount ? Math.floor(rand() * (width - aoiCount + 1)) : 0
      const columns: number[] = [Math.floor(rand() * width)]
      const packed = 1 + Math.floor(rand() * 12)
      for (let p = 0; p < packed; p++) {
        columns.push(rand() < 0.1 ? -1 : Math.floor(rand() * (width + 3)))
      }

      // Row-end bytes the file does not use are content; so are characters
      // whose UTF-16 bytes look like a tab or a row end (U+0109, U+0D0A).
      const strays = rowEnd === 'lf' ? ['\r'] : rowEnd === 'cr' ? ['\n'] : ['\r', '\n']
      const cellPool = ['', '', '', '1', '1', '0', '11', 'x', 'abc', ' 1', '1 ', '12.5', 'ž', 'ĉ', 'ഊ', ...strays]
      const lines: string[] = []
      const rowCount = Math.floor(rand() * 80)
      for (let r = 0; r < rowCount; r++) {
        if (rand() < 0.05) {
          lines.push('')
          continue
        }
        const cols = rand() < 0.15 ? Math.floor(rand() * (width + 5)) : width
        const cells: string[] = []
        const dense = rand() < 0.5
        for (let c = 0; c < cols; c++) {
          cells.push(dense ? pick(cellPool) : rand() < 0.85 ? '' : pick(cellPool))
        }
        lines.push(cells.join(delimiter))
      }
      let text = lines.join(ROW_DELIMITER[rowEnd])
      if (rand() < 0.5) text += ROW_DELIMITER[rowEnd]
      // A row ending in a stray CR right before CRLF is just content + CRLF.
      const bytes = encodeString(text, encoding)

      const expected = referenceRowScan(bytes, encoding, rowEnd, delimiter).map(row =>
        expectedLine(bytes, row, encoding, columns, aoiStart, aoiCount)
      )
      const scanned = new ProbeParser(delimiter, encoding, columns, aoiStart, aoiCount)
      viaFeed(scanned, rowEnd, chunked(bytes, rand))
      expect(scanned.rows, `seed ${seed} ${encoding} ${rowEnd}`).toEqual(expected)
    }
  })

  test('long rows spanning many chunks', () => {
    for (const encoding of ['utf-8', 'utf-16le'] as const) {
      const cells = Array.from({ length: 3000 }, (_, i) => (i % 97 === 0 ? '1' : ''))
      const text = Array.from({ length: 20 }, () => cells.join('\t')).join('\r\n')
      const bytes = encodeString(text, encoding)
      const columns = [0, 5, 2999]
      const expected = referenceRowScan(bytes, encoding, 'crlf', '\t').map(row =>
        expectedLine(bytes, row, encoding, columns, 10, 2900)
      )
      const scanned = new ProbeParser('\t', encoding, columns, 10, 2900)
      viaFeed(scanned, 'crlf', chunked(bytes, mulberry32(7)))
      expect(scanned.rows).toEqual(expected)
    }
  })

  test('processRowBytes scans exactly one row, empty included', () => {
    for (const encoding of ['utf-8', 'utf-16le', 'utf-16be'] as const) {
      const probe = new ProbeParser(',', encoding, [0, 1, 3], 2, 2)
      const rows = ['a,b,1,1', '', 'x', ',,,', 'p,q\nr,1', '1,,1']
      for (const row of rows) probe.processRowBytes(encodeString(row, encoding))
      const expected = rows.map(row => {
        const bytes = encodeString(row, encoding)
        // A single row: no row ends at all (the LF in 'p,q\nr,1' is content).
        const unit = encoding === 'utf-8' ? 1 : 2
        const [whole] = referenceRowScan(bytes, encoding, 'cr', ',')
        const one: ReferenceRow = whole ?? { start: 0, end: 0, cells: [{ start: 0, end: 0 }] }
        return expectedLine(bytes, { ...one, end: bytes.length - (bytes.length % unit) }, encoding, [0, 1, 3], 2, 2)
      })
      expect(probe.rows).toEqual(expected)
    }
  })
})

describe('the same file in any encoding and row ending imports identically', () => {
  async function run(name: string, bytes: Uint8Array, userInput: string, chunkSize: number) {
    // Detection sees only the first chunk (the header must fit, as with real
    // File streams); the rest arrives in `chunkSize` pieces.
    const first = 65536
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, first))
        for (let i = first; i < bytes.length; i += chunkSize) {
          controller.enqueue(bytes.slice(i, i + chunkSize))
        }
        controller.close()
      },
    })
    const job = new IngestJob([name], FORMAT_REGISTRY, {
      prompt: async () => userInput,
      reportBytes: () => {},
    })
    // An outcome is the dataset or the error; settings legitimately differ.
    try {
      const result = await job.add(streamSource(name, stream))
      return result && 'data' in result ? { data: result.data } : result
    } catch (error) {
      return { error: (error as Error).message }
    }
  }

  const BOM: Record<TextEncoding, number[]> = {
    'utf-8': [0xef, 0xbb, 0xbf],
    'utf-16le': [0xff, 0xfe],
    'utf-16be': [0xfe, 0xff],
  }
  const encode = (text: string, encoding: TextEncoding, bom: boolean) => {
    const body = encodeString(text, encoding)
    if (!bom) return body
    const out = new Uint8Array(BOM[encoding].length + body.length)
    out.set(BOM[encoding], 0)
    out.set(body, BOM[encoding].length)
    return out
  }

  const csv = ['Time,Participant,Stimulus,AOI']
    .concat(
      Array.from({ length: 9000 }, (_, r) =>
        `${r * 16},P${r % 3},Stim_${r % 2},${r % 7 === 0 ? '' : `Region_${r % 5}`}`
      )
    )
    .join('\n')

  // Shaped like a wide Tobii Pro Lab screen study: media column plus
  // `<stimulus> IntervalStart/End` markers, so both parsing modes apply.
  const mediaTsv = (() => {
    const rand = mulberry32(42)
    const aois = Array.from({ length: 40 }, (_, i) => `AOI hit [S - A${i}]`)
    const header = ['Recording timestamp', 'Sensor', 'Participant name', 'Recording name', 'Event',
      'Presented Stimulus name', 'Eye movement type', 'Eye movement type index', ...aois]
    const lines = [header.join('\t')]
    let index = 1
    for (let r = 0; r < 3000; r++) {
      const ts = String(r * 8333)
      const participant = r < 1500 ? 'Ann' : 'Bob'
      const stimulus = `Stim${Math.floor(r / 400)}`
      const marker = (event: string) =>
        [ts, '', participant, 'Rec1', event, '', '', '', ...aois.map(() => '')].join('\t')
      if (r % 400 === 0) {
        if (r > 0) lines.push(marker(`Stim${r / 400 - 1} IntervalEnd`))
        lines.push(marker(`${stimulus} IntervalStart`))
      }
      if (r === 2999) lines.push(marker(`${stimulus} IntervalEnd`))
      if (r % 97 === 5) {
        lines.push([ts, '', participant, 'Rec1', 'MouseEvent', '', '', '', ...aois.map(() => '')].join('\t'))
        continue
      }
      if (r % 13 === 0) index++
      const type = index % 3 === 0 ? 'Saccade' : 'Fixation'
      const hits = aois.map(() => (rand() < 0.05 ? '1' : rand() < 0.3 ? '0' : ''))
      const sensor = r % 11 === 3 ? 'Mouse' : 'Eye Tracker'
      lines.push([ts, sensor, participant, 'Rec1', '', stimulus, type, String(index), ...hits].join('\t'))
    }
    return lines.join('\n')
  })()

  const intervals = '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}'
  const files: Array<[string, string, string]> = [
    ['plain.csv', csv, ''],
    ['media.tsv', mediaTsv, ''],
    ['interval.tsv', mediaTsv, intervals],
    ['mobile.tsv', testMobileTsvData.trimEnd(), ''],
  ]
  const variants: Array<[TextEncoding, string, boolean]> = [
    ['utf-8', '\r\n', false],
    ['utf-8', '\r', true],
    ['utf-16le', '\n', true],
    ['utf-16le', '\r\n', true],
    ['utf-16be', '\r', true],
  ]

  test.each(files)('%s #%#', async (name, text, userInput) => {
    const reference = await run(name, encode(text, 'utf-8', false), userInput, 1 << 20)
    // The fixture alone has no stimuli; everything else must parse.
    if (name !== 'mobile.tsv') expect(reference).toHaveProperty('data')
    for (const [encoding, eol, bom] of variants) {
      const bytes = encode(text.replace(/\n/g, eol), encoding, bom)
      for (const chunkSize of [37, 4096]) {
        expect(await run(name, bytes, userInput, chunkSize), `${encoding} ${JSON.stringify(eol)} ${chunkSize}`).toEqual(reference)
      }
    }
  })
})
