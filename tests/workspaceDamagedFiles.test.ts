import { describe, expect, it } from 'vitest'
import { processAndValidateData } from '$lib/data/ingest/workspace/validator'
import { processJsonFileWithGrid } from '$lib/data/ingest/workspace/parser'
import { readSegmentEntries } from '$lib/data/binary/storedSegments'
import { workspaceZipFormat } from '$lib/data/ingest/formats/workspaceZip'
import { writeBlobZip } from '$lib/data/zip/blobZip'
import {
  isTobiiJson,
  processTobii,
} from '$lib/modals/import/shared/aoiVisibilityServices'
import type { RawIngestPayload } from '$lib/data/types'
import { makeDataType } from './helpers/dataTypeFixtures'

// An overnight fuzzer found damaged workspace files that crashed the importer
// with the engine's TypeError or RangeError. Each case below is one signature
// family; the importer now refuses them all under one message prefix.

const invalid = /^Invalid workspace file: /

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

function payload(tamper: (data: Raw) => void): RawIngestPayload {
  const data = makeDataType([[[[0, 100, 0, 0]]], [[[0, 80, 0, 0]]]]) as unknown as Raw
  tamper(data)
  return data as RawIngestPayload
}

const refuses = (tamper: (data: Raw) => void) =>
  expect(() => processAndValidateData(payload(tamper))).toThrow(invalid)

describe('damaged workspace files are refused with a clear message', () => {
  it('accepts an intact payload', () => {
    expect(() => processAndValidateData(payload(() => {}))).not.toThrow()
  })

  it('refuses a top-level container that is not an object', () => {
    refuses(d => (d.participants = 'x'))
    refuses(d => (d.stimuli = true))
    // The legacy flat layout runs through the migration chain first, which
    // used to crash creating orderVector on the primitive.
    const flat = {
      version: 2,
      ...payload(d => (d.categories = 7)),
      segments: [[[[0, 100, 0]]], [[[0, 80, 0]]]],
    }
    expect(() => processJsonFileWithGrid(JSON.stringify(flat))).toThrow(invalid)
  })

  it('refuses a missing or empty container', () => {
    refuses(d => delete d.aois)
    refuses(d => (d.aois = {}))
    refuses(d => delete d.aois.data)
  })

  it('refuses a name cell or row that is not a list of strings', () => {
    refuses(d => (d.categories.data[0][0] = 5))
    refuses(d => (d.aois.data[0][0][1] = 3))
    refuses(d => (d.aois.data[0][0] = 9))
    refuses(d => (d.aois.data[0][0] = []))
    refuses(d => (d.participants.data[1] = null))
  })

  it('refuses event tables that are not nested lists', () => {
    refuses(d => (d.eventData.events = 5))
    refuses(d => (d.eventData.events[0] = null))
    refuses(d => (d.eventData.events[0] = [7]))
    refuses(d => (d.eventData.data = 'x'))
  })

  it('refuses a primitive where a container or a segment list belongs', () => {
    refuses(d => (d.eventData = 7))
    refuses(d => (d.segments = ['x', [[[0, 80, 0]]]]))
    refuses(d => (d.segments = [[5], [[[0, 80, 0]]]]))
  })

  it('names the damaged field in plain words', () => {
    expect(() => processAndValidateData(payload(d => (d.stimuli = 'x')))).toThrow(
      'Invalid workspace file: stimuli is not an object'
    )
    expect(() =>
      processAndValidateData(payload(d => (d.participants.data[0] = [1])))
    ).toThrow('Invalid workspace file: participants.data is not a list of name rows')
  })

  it('refuses a truncated segment entry instead of a RangeError', async () => {
    const marker = {
      stored: 'entries' as const,
      maxParticipants: 1,
      stimuliCount: 1,
      hasSpatialData: false,
    }
    const read = (name: string) =>
      Promise.resolve(new ArrayBuffer(name.endsWith('indexTable') ? 7 : 8))
    await expect(readSegmentEntries(marker, read)).rejects.toThrow(
      'Invalid workspace file: the segments/indexTable entry is truncated'
    )
  })

  it('refuses a damaged archive instead of a DataView RangeError', async () => {
    const { blob } = await writeBlobZip([{ name: 'workspace.json', content: '{}' }])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // The end record's central directory offset now points past the file.
    new DataView(bytes.buffer).setUint32(bytes.length - 6, 0xfffffff0, true)
    const ctx = { prompt: async () => '', reportBytes: () => {} }
    await expect(workspaceZipFormat.read(new Blob([bytes]), ctx)).rejects.toThrow(
      'Invalid workspace file: the archive is truncated or damaged'
    )
  })
})

describe('damaged legacy AOI visibility files', () => {
  const frame = (active: boolean, seconds: number) => ({
    IsActive: active,
    Seconds: seconds,
    Vertices: [],
  })
  const aoi = {
    Red: 0,
    Green: 0,
    Blue: 0,
    Name: 'a',
    Tags: [],
    KeyFrames: { 0: frame(true, 0), 1: frame(false, 1) },
  }
  const file = (aois: Record<number, unknown>) =>
    ({ Tags: [], Media: {}, Version: 0, Aois: aois }) as never

  it('is not claimed when the first AOI or key frame is not an object', () => {
    expect(isTobiiJson(file({ 0: null }))).toBe(false)
    expect(isTobiiJson(file({ 0: { ...aoi, KeyFrames: { 0: 0 } } }))).toBe(false)
    expect(isTobiiJson(file({ 0: aoi }))).toBe(true)
  })

  it('refuses a later AOI or key frame that is not an object', () => {
    expect(() => processTobii(0, null, file({ 0: aoi, 1: null }))).toThrow(
      'Invalid AOI visibility file: AOI 1 is not an object'
    )
    const frames = { ...aoi, KeyFrames: { 0: frame(true, 0), 1: null } }
    expect(() => processTobii(0, null, file({ 0: frames }))).toThrow(
      'Invalid AOI visibility file: key frame 1 is not an object'
    )
  })
})
