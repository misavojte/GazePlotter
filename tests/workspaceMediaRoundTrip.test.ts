import { describe, expect, it } from 'vitest'
import type { DataType, StimulusMedia } from '../src/lib/data/types'
import { makeDataType } from './helpers/dataTypeFixtures'
import { buildWorkspace } from '../src/lib/data/export/controller'
import { workspaceZipFormat } from '../src/lib/data/ingest/formats/workspaceZip'
import { workspaceJsonFormat } from '../src/lib/data/ingest/formats/workspaceJson'
import { StimulusMediaStore } from '../src/lib/data/media/mediaStore.svelte'
import {
  matchMediaFilesToStimuli,
  mediaKindOf,
} from '../src/lib/data/media/mediaUpload'

// Round trip of per-stimulus reference media through the workspace container:
// no media → the plain-JSON export of always; media → a .gazeplotter.zip with
// workspace.json + media/<id>.<ext> entries, restored to metadata + Blobs.

const MEDIA: StimulusMedia = {
  // Custom gaze-space mapping included so the round trip covers `region`.
  region: { x: 100, y: 50, width: 960, height: 540 },
  kind: 'image',
  mimeType: 'image/png',
  fileName: 'scene.png',
  naturalWidth: 1920,
  naturalHeight: 1080,
}

function createData(withMedia: boolean): DataType {
  return makeDataType([[[[0, 100, 0, 0]]]], {
    stimuli: { data: [['Stimulus A', 'Stimulus A']], orderVector: [0] },
    participants: { data: [['P1', 'P1']], orderVector: [0] },
    aois: { data: [[['AOI 1', 'AOI 1', '#ff0000']]], orderVector: [[0]] },
    ...(withMedia ? { stimuliMedia: { 0: MEDIA } } : {}),
  })
}

const ingestCtx = { prompt: async () => '', reportBytes: () => {} }

function storeWith(blob: Blob | null): StimulusMediaStore {
  const store = new StimulusMediaStore()
  if (blob) store.setBlob(0, blob)
  return store
}

describe('workspace media round trip', () => {
  it('exports plain JSON when no stimulus has media', async () => {
    const payload = await buildWorkspace(createData(false), [], null, storeWith(null))
    expect(payload.extension).toBe('.json')
    expect(typeof payload.content).toBe('string')
    expect((payload.content as string).includes('stimuliMedia')).toBe(false)
  })

  it('exports a .gazeplotter.zip with media and re-imports it losslessly', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4])
    const payload = await buildWorkspace(
      createData(true),
      [],
      null,
      storeWith(new Blob([bytes], { type: MEDIA.mimeType }))
    )
    expect(payload.extension).toBe('.gazeplotter.zip')
    expect(payload.content).toBeInstanceOf(Blob)
    expect(payload.skippedMedia).toEqual([])

    const result = await workspaceZipFormat.read(payload.content as Blob, ingestCtx)
    if (result.kind !== 'workspace') throw new Error('expected workspace')

    expect(result.data.stimuliMedia).toEqual({ 0: MEDIA })
    const blob = result.mediaBlobs?.[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(bytes)
    expect(blob!.type).toBe(MEDIA.mimeType)
  })

  it('leaves out an unreadable medium and reports its stimulus', async () => {
    const unreadable = new Blob([new Uint8Array([1])], { type: 'image/png' })
    unreadable.stream = () => {
      throw new DOMException('moved', 'NotReadableError')
    }
    const payload = await buildWorkspace(createData(true), [], null, storeWith(unreadable))
    expect(payload.skippedMedia).toEqual([0])

    const result = await workspaceZipFormat.read(payload.content as Blob, ingestCtx)
    if (result.kind !== 'workspace') throw new Error('expected workspace')
    expect(result.mediaBlobs).toEqual({})
  })

  it('tolerates a missing media entry (drops only that blob)', async () => {
    const payload = await buildWorkspace(createData(true), [], null, storeWith(null))
    const result = await workspaceZipFormat.read(payload.content as Blob, ingestCtx)
    if (result.kind !== 'workspace') throw new Error('expected workspace')
    // Metadata still present at parse time; the ingest apply reconciles it
    // against the (empty) blob map and warns.
    expect(result.mediaBlobs).toEqual({})
    expect(result.data.stimuliMedia).toEqual({ 0: MEDIA })
  })

  describe('matching uploaded media to stimuli', () => {
    const fakeFile = (name: string, type = 'image/png') =>
      new File([new Uint8Array([1])], name, { type })
    const stim = (id: number, originalName: string, displayedName = originalName) => ({
      id,
      originalName,
      displayedName,
    })

    it('matches by base name against original or displayed name, case-insensitive', () => {
      const { matches, unmatched } = matchMediaFilesToStimuli(
        [fakeFile('map_a.png'), fakeFile('City Map 2.mp4', 'video/mp4'), fakeFile('unrelated.png')],
        [stim(0, 'Map_A', 'City map'), stim(1, 'Map_B', 'City Map 2')]
      )
      expect(matches.get(0)?.name).toBe('map_a.png')
      expect(matches.get(1)?.name).toBe('City Map 2.mp4')
      expect(unmatched.map(f => f.name)).toEqual(['unrelated.png'])
    })

    it('matches stimuli named after their file, extension included or swapped', () => {
      const { matches, unmatched } = matchMediaFilesToStimuli(
        [fakeFile('scene.jpg', 'image/jpeg'), fakeFile('poster.png'), fakeFile('Trial 1.5.png')],
        [stim(0, 'scene.jpg'), stim(1, 'poster.jpg'), stim(2, 'Trial 1.5')]
      )
      expect(matches.get(0)?.name).toBe('scene.jpg')
      expect(matches.get(1)?.name).toBe('poster.png')
      expect(matches.get(2)?.name).toBe('Trial 1.5.png')
      expect(unmatched).toEqual([])
    })

    it('prefers an exact name over an extension-stripped one', () => {
      // `intro.png` names stimulus 1 exactly; stimulus 0 only matches once
      // its own extension is stripped.
      const { matches } = matchMediaFilesToStimuli(
        [fakeFile('intro.png')],
        [stim(0, 'intro.jpg'), stim(1, 'intro.png')]
      )
      expect(matches.get(1)?.name).toBe('intro.png')
      expect(matches.size).toBe(1)
    })

    it('keeps the first file per stimulus and hands later claimants to the picker', () => {
      const { matches, unmatched } = matchMediaFilesToStimuli(
        [fakeFile('map_a.png'), fakeFile('City Map.mp4', 'video/mp4')],
        [stim(0, 'Map_A', 'City map')]
      )
      expect(matches.get(0)?.name).toBe('map_a.png')
      expect(unmatched.map(f => f.name)).toEqual(['City Map.mp4'])
    })

    it('only matches the stimuli it is given (callers pass the visible ones)', () => {
      const { matches, unmatched } = matchMediaFilesToStimuli(
        [fakeFile('merged_member.png')],
        [stim(0, 'Survivor')]
      )
      expect(matches.size).toBe(0)
      expect(unmatched.map(f => f.name)).toEqual(['merged_member.png'])
    })
  })

  it('classifies media files by mime with extension fallback', () => {
    const f = (name: string, type: string) => new File([], name, { type })
    expect(mediaKindOf(f('a.png', 'image/png'))).toBe('image')
    expect(mediaKindOf(f('a.mp4', 'video/mp4'))).toBe('video')
    expect(mediaKindOf(f('a.mov', ''))).toBe('video')
    expect(mediaKindOf(f('a.webp', ''))).toBe('image')
    expect(mediaKindOf(f('a.csv', 'text/csv'))).toBe(null)
    expect(mediaKindOf(f('a.csv', ''))).toBe(null)
  })

  it('workspace archives claim only the .gazeplotter.zip suffix', () => {
    expect(workspaceZipFormat.matchesFileName('study.gazeplotter.zip')).toBe(true)
    expect(workspaceZipFormat.matchesFileName('STUDY.GazePlotter.Zip')).toBe(true)
    expect(workspaceZipFormat.matchesFileName('pupil-export.zip')).toBe(false)
    expect(workspaceJsonFormat.matchesFileName('study.gazeplotter.zip')).toBe(false)
  })
})
