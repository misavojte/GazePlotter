import { describe, expect, it } from 'vitest'
import type { DataType, StimulusMedia } from '../src/lib/data/types'
import { makeDataType } from './helpers/dataTypeFixtures'
import { buildWorkspace } from '../src/lib/data/export/controller'
import { workspaceZipFormat } from '../src/lib/data/ingest/formats/workspaceZip'
import { workspaceJsonFormat } from '../src/lib/data/ingest/formats/workspaceJson'
import { stimulusMediaStore } from '../src/lib/data/media/mediaStore.svelte'
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

describe('workspace media round trip', () => {
  it('exports plain JSON when no stimulus has media', async () => {
    const payload = await buildWorkspace(createData(false), [], null)
    expect(payload.extension).toBe('.json')
    expect(typeof payload.content).toBe('string')
    expect((payload.content as string).includes('stimuliMedia')).toBe(false)
  })

  it('exports a .gazeplotter.zip with media and re-imports it losslessly', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4])
    stimulusMediaStore.setBlob(0, new Blob([bytes], { type: MEDIA.mimeType }))
    try {
      const payload = await buildWorkspace(createData(true), [], null)
      expect(payload.extension).toBe('.gazeplotter.zip')
      expect(payload.content).toBeInstanceOf(Blob)

      const zipBytes = new Uint8Array(
        await (payload.content as Blob).arrayBuffer()
      )
      const result = await workspaceZipFormat.read(zipBytes, ingestCtx)
      if (result.kind !== 'workspace') throw new Error('expected workspace')

      expect(result.data.stimuliMedia).toEqual({ 0: MEDIA })
      const blob = result.mediaBlobs?.[0]
      expect(blob).toBeInstanceOf(Blob)
      expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(bytes)
      expect(blob!.type).toBe(MEDIA.mimeType)
    } finally {
      stimulusMediaStore.clear()
    }
  })

  it('tolerates a missing media entry (drops only that blob)', async () => {
    stimulusMediaStore.setBlob(0, new Blob([new Uint8Array([1])], { type: 'image/png' }))
    try {
      const payload = await buildWorkspace(createData(true), [], null)
      const JSZipLib = (await import('jszip')).default
      const zip = await JSZipLib.loadAsync(await (payload.content as Blob).arrayBuffer())
      zip.remove('media/0.png')
      const stripped = new Uint8Array(
        await zip.generateAsync({ type: 'arraybuffer' })
      )

      const result = await workspaceZipFormat.read(stripped, ingestCtx)
      if (result.kind !== 'workspace') throw new Error('expected workspace')
      // Metadata still present at parse time; the ingest apply reconciles it
      // against the (empty) blob map and warns.
      expect(result.mediaBlobs).toEqual({})
      expect(result.data.stimuliMedia).toEqual({ 0: MEDIA })
    } finally {
      stimulusMediaStore.clear()
    }
  })

  it('matches uploaded media to stimuli by base name, case-insensitive', () => {
    const fakeFile = (name: string, type = 'image/png') =>
      new File([new Uint8Array([1])], name, { type })
    const stimuli = [
      ['Map_A', 'City map'],
      ['Map_B', 'Map_B'],
    ]
    const { matches, unmatched } = matchMediaFilesToStimuli(
      [
        fakeFile('map_a.png'), // original name, case-insensitive
        fakeFile('City Map.mp4', 'video/mp4'), // displayed name — later file wins the slot
        fakeFile('unrelated.png'),
      ],
      stimuli
    )
    expect(matches.get(0)?.name).toBe('City Map.mp4')
    expect(matches.size).toBe(1)
    expect(unmatched.map(f => f.name)).toEqual(['unrelated.png'])
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
