import { describe, expect, it } from 'vitest'
import { processAndValidateData } from '$lib/data/ingest/workspace/validator'
import type { RawIngestPayload } from '$lib/data/types'
import { makeDataType } from './helpers/dataTypeFixtures'

// A .gazeplotter file stores stimuliCount, maxParticipants and the index
// table as separate entries, and every reader loop is sized by them. A
// damaged count used to hang the import for good; the validator now refuses
// the file instead.

type Segments = ReturnType<typeof makeDataType>['segments']

function payload(tamper: (segments: Segments) => void): RawIngestPayload {
  const data = makeDataType([
    [
      [
        [0, 100, 0, 0],
        [100, 200, 0, 0],
      ],
      [[0, 50, 0, 0]],
    ],
    [[[0, 80, 0, 0]]],
  ])
  tamper(data.segments)
  return data as unknown as RawIngestPayload
}

const invalid = /Invalid workspace file/

describe('workspace segment tables must agree with the stored counts', () => {
  it('accepts buffers whose counts match the tables', () => {
    expect(() => processAndValidateData(payload(() => {}))).not.toThrow()
  })

  it('refuses a stimuliCount that does not size the index table', () => {
    expect(() =>
      processAndValidateData(
        payload(s => {
          s.stimuliCount = 1_000_000_000
        })
      )
    ).toThrow(invalid)
    expect(() =>
      processAndValidateData(
        payload(s => {
          s.maxParticipants = 3
        })
      )
    ).toThrow(invalid)
    expect(() =>
      processAndValidateData(
        payload(s => {
          s.stimuliCount = 1.5
        })
      )
    ).toThrow(invalid)
  })

  it('refuses index ranges that reach past the segment buffer or run backwards', () => {
    expect(() =>
      processAndValidateData(
        payload(s => {
          s.indexTable[1] = 4_000_000_000
        })
      )
    ).toThrow(invalid)
    expect(() =>
      processAndValidateData(
        payload(s => {
          s.indexTable[0] = 2
          s.indexTable[1] = 1
        })
      )
    ).toThrow(invalid)
  })

  it('refuses a fixation index table of another size', () => {
    expect(() =>
      processAndValidateData(
        payload(s => {
          s.fixationIndexTable = new Uint32Array(2)
        })
      )
    ).toThrow(invalid)
  })
})
