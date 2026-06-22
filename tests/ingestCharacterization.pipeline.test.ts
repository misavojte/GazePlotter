/**
 * CHARACTERIZATION TESTS — ingest, end to end.
 *
 * Phase 0 of the ingest v2 refactor. Runs the REAL `IngestJob` in-process
 * (no worker) over small synthetic files and pins the produced `DataType`
 * as a JSON digest: names, categories, capabilities, and the exact decoded
 * segment tuples per (stimulus, participant). These digests were pinned
 * against the pre-refactor `EyePipeline` and must never drift.
 *
 * Inline snapshots are auto-filled by vitest on first run and reviewed by
 * hand — they ARE the spec; do not regenerate them casually.
 */

import { describe, expect, test } from 'vitest'
import { IngestJob } from '$lib/data/ingest/kernel/job'
import { streamSource } from '$lib/data/ingest/kernel/source'
import type { IngestResult } from '$lib/data/ingest/kernel/result'
import { FORMAT_REGISTRY } from '$lib/data/ingest/formats/registry'
import { BinaryBufferReader } from '$lib/data/binary'
import type { DataType } from '$lib/data/types'
import type { ParseSettings } from '$lib/data/ingest/types'
import { testMobileTsvData } from './TobiiRowParser.test.data'

function streamFromString(content: string, chunkSize = 64 * 1024) {
  const bytes = new TextEncoder().encode(content)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(
          bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
        )
      }
      controller.close()
    },
  })
}

async function runPipeline(
  files: Array<{ name: string; content: string }>,
  options: { userInput?: string; chunkSize?: number } = {}
): Promise<{ data: DataType; settings: ParseSettings; warnings: string[] }> {
  const job = new IngestJob(
    files.map(f => f.name),
    FORMAT_REGISTRY,
    {
      prompt: async () => options.userInput ?? '',
      reportBytes: () => {},
    }
  )
  let result: IngestResult | null = null
  for (const file of files) {
    result = await job.add(
      streamSource(file.name, streamFromString(file.content, options.chunkSize))
    )
  }
  if (!result) throw new Error('job did not produce a final result')
  if (result.kind !== 'dataset') throw new Error('expected a dataset result')
  return {
    data: result.data,
    settings: result.settings,
    warnings: result.warnings ?? [],
  }
}

/**
 * Digest of a DataType for snapshot pinning: everything semantically
 * observable, nothing incidental. Segment tuples are
 * [start, end, categoryId, aoiIds[]] in storage order.
 */
function digest(data: DataType) {
  const reader = new BinaryBufferReader(data.segments)
  const segments: Record<string, Array<[number, number, number, number[]]>> = {}
  for (let s = 0; s < data.stimuli.data.length; s++) {
    for (let p = 0; p < data.participants.data.length; p++) {
      const tuples: Array<[number, number, number, number[]]> = []
      reader.forEachSegment(s, p, i => {
        tuples.push([
          Number(reader.getSegmentStart(i).toFixed(3)),
          Number(reader.getSegmentEnd(i).toFixed(3)),
          reader.getSegmentCategory(i),
          Array.from(reader.getRawAois(i)),
        ])
      })
      if (tuples.length > 0) {
        segments[`${data.stimuli.data[s][0]}/${data.participants.data[p][0]}`] =
          tuples
      }
    }
  }
  return {
    stimuli: data.stimuli.data,
    participants: data.participants.data,
    categories: data.categories.data,
    aois: data.aois.data,
    capabilities: data.capabilities,
    isOrdinalOnly: data.isOrdinalOnly,
    hasSpatialData: data.segments.hasSpatialData,
    segments,
  }
}

const csvContent = `Time,Participant,Stimulus,AOI
0,P1,Map_A,Region_1
1,P1,Map_A,Region_1
2,P1,Map_A,Region_2
3,P1,Map_A,
4,P2,Map_A,Region_1
5,P2,Map_A,Region_1
6,P1,Map_B,Region_1
7,P1,Map_B,Region_2`

describe('pipeline end-to-end: csv', () => {
  test('single file produces the pinned dataset', async () => {
    const { data, settings } = await runPipeline([
      { name: 'data.csv', content: csvContent },
    ])
    expect(settings).toEqual({
      type: 'csv',
      rowDelimiter: '\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
    expect(digest(data)).toMatchInlineSnapshot(`
      {
        "aois": [
          [
            [
              "Region_1",
            ],
            [
              "Region_2",
            ],
          ],
          [
            [
              "Region_1",
            ],
            [
              "Region_2",
            ],
          ],
        ],
        "capabilities": {
          "event": false,
          "segmented": true,
          "spatial": false,
        },
        "categories": [
          [
            "Fixation",
          ],
        ],
        "hasSpatialData": false,
        "isOrdinalOnly": false,
        "participants": [
          [
            "P1",
          ],
          [
            "P2",
          ],
        ],
        "segments": {
          "Map_A/P1": [
            [
              0,
              1,
              0,
              [
                0,
              ],
            ],
            [
              2,
              2,
              0,
              [
                1,
              ],
            ],
            [
              3,
              3,
              0,
              [],
            ],
          ],
          "Map_A/P2": [
            [
              0,
              1,
              0,
              [
                0,
              ],
            ],
          ],
          "Map_B/P1": [
            [
              0,
              0,
              0,
              [
                0,
              ],
            ],
            [
              1,
              1,
              0,
              [
                1,
              ],
            ],
          ],
        },
        "stimuli": [
          [
            "Map_A",
          ],
          [
            "Map_B",
          ],
        ],
      }
    `)
  })

  test('chunk boundaries inside data rows do not change the result', async () => {
    // 31 bytes: the header line fits in the first chunk; every following
    // row is split across chunk boundaries.
    const whole = await runPipeline([{ name: 'data.csv', content: csvContent }])
    const chunked = await runPipeline(
      [{ name: 'data.csv', content: csvContent }],
      { chunkSize: 31 }
    )
    expect(digest(chunked.data)).toEqual(digest(whole.data))
  })

  test('CHARACTERIZED CONSTRAINT: the header row must fit in the first chunk', () => {
    // Detection sees only the source's first chunk (the probe). If the header
    // is split across chunks (never the case with real File streams, which
    // deliver ≥64KB chunks), detection fails. Inherited from the v1 pipeline,
    // kept knowingly.
    return expect(
      runPipeline([{ name: 'data.csv', content: csvContent }], { chunkSize: 3 })
    ).rejects.toThrow('Unknown file type')
  })

  test('multi-file upload accumulates into one dataset; result only on last file', async () => {
    const second = `Time,Participant,Stimulus,AOI
0,P3,Map_A,Region_2
1,P3,Map_A,Region_2`
    const job = new IngestJob(['a.csv', 'b.csv'], FORMAT_REGISTRY, {
      prompt: async () => '',
      reportBytes: () => {},
    })
    const first = await job.add(
      streamSource('a.csv', streamFromString(csvContent))
    )
    expect(first).toBeNull()
    const final = await job.add(streamSource('b.csv', streamFromString(second)))
    expect(final).not.toBeNull()
    const d = digest(final!.data)
    expect(d.participants).toEqual([['P1'], ['P2'], ['P3']])
    expect(d.segments['Map_A/P3']).toEqual([[0, 1, 0, [1]]])
  })
})

describe('pipeline end-to-end: begaze', () => {
  test('produces the pinned dataset', async () => {
    const content = `Event Start Trial Time [ms]\tEvent End Trial Time [ms]\tStimulus\tParticipant\tCategory\tAOI Name
0\t100\tMap_A\tP1\tFixation\tRegion_1
100\t150\tMap_A\tP1\tSaccade\t-
150\t300\tMap_A\tP1\tFixation\tRegion_2
0\t80\tMap_A\tP2\tFixation\tRegion_1`
    const { data, settings } = await runPipeline([
      { name: 'data.txt', content },
    ])
    expect(settings.type).toBe('begaze')
    expect(digest(data)).toMatchInlineSnapshot(`
      {
        "aois": [
          [
            [
              "Region_1",
            ],
            [
              "Region_2",
            ],
          ],
        ],
        "capabilities": {
          "event": false,
          "segmented": true,
          "spatial": false,
        },
        "categories": [
          [
            "Fixation",
          ],
          [
            "Saccade",
          ],
        ],
        "hasSpatialData": false,
        "isOrdinalOnly": false,
        "participants": [
          [
            "P1",
          ],
          [
            "P2",
          ],
        ],
        "segments": {
          "Map_A/P1": [
            [
              0,
              100,
              0,
              [
                0,
              ],
            ],
            [
              100,
              150,
              1,
              [],
            ],
            [
              150,
              300,
              0,
              [
                1,
              ],
            ],
          ],
          "Map_A/P2": [
            [
              0,
              80,
              0,
              [
                0,
              ],
            ],
          ],
        },
        "stimuli": [
          [
            "Map_A",
          ],
        ],
      }
    `)
  })
})

describe('pipeline end-to-end: csv-segmented (From/To)', () => {
  test('produces the pinned dataset', async () => {
    const content = `From,To,Participant,Stimulus,AOI
0,100,P1,Map_A,Region_1
100,250,P1,Map_A,Region_2
0,90,P2,Map_A,Region_1`
    const { data, settings } = await runPipeline([
      { name: 'data.csv', content },
    ])
    expect(settings.type).toBe('csv-segmented')
    expect(digest(data)).toMatchInlineSnapshot(`
      {
        "aois": [
          [
            [
              "Region_1",
            ],
            [
              "Region_2",
            ],
          ],
        ],
        "capabilities": {
          "event": false,
          "segmented": true,
          "spatial": false,
        },
        "categories": [
          [
            "Fixation",
          ],
        ],
        "hasSpatialData": false,
        "isOrdinalOnly": false,
        "participants": [
          [
            "P1",
          ],
          [
            "P2",
          ],
        ],
        "segments": {
          "Map_A/P1": [
            [
              0,
              100,
              0,
              [
                0,
              ],
            ],
            [
              100,
              250,
              0,
              [
                1,
              ],
            ],
          ],
          "Map_A/P2": [
            [
              0,
              90,
              0,
              [
                0,
              ],
            ],
          ],
        },
        "stimuli": [
          [
            "Map_A",
          ],
        ],
      }
    `)
  })
})

describe('pipeline end-to-end: csv-segmented-duration', () => {
  test('produces the pinned dataset', async () => {
    const content = `stimulus,participant,timestamp,duration,eyemovementtype,AOI
Map_A,P1,0,100,0,Region_1
Map_A,P1,100,50,1,
Map_A,P1,150,150,0,Region_2`
    const { data, settings } = await runPipeline([
      { name: 'data.csv', content },
    ])
    expect(settings.type).toBe('csv-segmented-duration')
    expect(digest(data)).toMatchInlineSnapshot(`
      {
        "aois": [
          [
            [
              "Region_1",
            ],
            [
              "Region_2",
            ],
          ],
        ],
        "capabilities": {
          "event": false,
          "segmented": true,
          "spatial": false,
        },
        "categories": [
          [
            "Fixation",
          ],
          [
            "Saccade",
          ],
        ],
        "hasSpatialData": false,
        "isOrdinalOnly": false,
        "participants": [
          [
            "P1",
          ],
        ],
        "segments": {
          "Map_A/P1": [
            [
              0,
              100,
              0,
              [
                0,
              ],
            ],
            [
              100,
              150,
              1,
              [],
            ],
            [
              150,
              300,
              0,
              [
                1,
              ],
            ],
          ],
        },
        "stimuli": [
          [
            "Map_A",
          ],
        ],
      }
    `)
  })
})

describe('pipeline end-to-end: tobii with events (user-input flow)', () => {
  test('an interval that opens but never closes is reported and excluded', async () => {
    // The fixture's only stimulus marker is a `geostul_snap IntervalStart`
    // with no matching `IntervalEnd` — an unclosed interval whose extent is
    // undefined. The parser used to fabricate a segment spanning to the last
    // sample (460.841 ms); that is scientifically wrong, so the impacted
    // (stimulus, participant) is now dropped and the problem is reported.
    const { data, settings } = await runPipeline(
      [{ name: 'tobii.tsv', content: testMobileTsvData }],
      { userInput: '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}' }
    )
    expect(settings.type).toBe('tobii-with-event')
    const d = digest(data)
    // The stimulus and participant are still discovered from the markers …
    expect(d.stimuli).toEqual([['geostul_snap']])
    expect(d.participants).toEqual([['Recording 16 Y1']])
    // … but the malformed group contributes NO segments.
    expect(d.segments['geostul_snap/Recording 16 Y1']).toBeUndefined()
    // The exclusion is cemented into the dataset as persisted metadata,
    // naming the participant, the stimulus, and the malformed-sequence kind.
    expect(data.dataExclusions).toEqual([
      {
        stimulus: 'geostul_snap',
        participant: 'Recording 16 Y1',
        issues: [expect.objectContaining({ kind: 'unclosed-start' })],
      },
    ])
  })
})

describe('pipeline error strings (user-facing, must not change)', () => {
  test('file with no data rows fails with the generic no-stimuli message', async () => {
    await expect(
      runPipeline([
        { name: 'empty.csv', content: 'Time,Participant,Stimulus,AOI' },
      ])
    ).rejects.toThrow(
      'Parsing unsuccessful: No stimuli found. Please check your data file.'
    )
  })

  test('tobii with custom media parsing and no matching intervals fails with the tobii-specific message', async () => {
    const headerOnly = testMobileTsvData.split('\n')[0]
    await expect(
      runPipeline([{ name: 'tobii.tsv', content: headerOnly }], {
        userInput:
          '{"stimulusStartSuffix":"NoSuchStart","stimulusEndSuffix":"NoSuchEnd"}',
      })
    ).rejects.toThrow(
      'No intervals to form stimuli were found. Try default media parsing.'
    )
  })
})
