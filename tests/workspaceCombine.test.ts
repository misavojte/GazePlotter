import { describe, expect, it } from 'vitest'
import { ingest } from '../src/lib/data/ingest/ingest'
import { generateWorkspaceJson } from '../src/lib/data/export/mappers/workspace'
import { jsonSegmentsToBinary } from '../src/lib/data/binary'
import type { FileMetadataType } from '../src/lib/data/ingest/types'
import { makeDataType, nestedSegments } from './helpers/dataTypeFixtures'

const workspace = (name: string, data: ReturnType<typeof makeDataType>, gridItems: object[] = [], parseDate?: string) => {
  const metadata = parseDate ? ({ status: 'success', fileNames: [`${name}.tsv`], fileSizes: [1], parseDate } as FileMetadataType) : null
  return new File([generateWorkspaceJson(data, gridItems, metadata)], name)
}

// First collection: P0 on S0, looking at AOI 'A'.
const first = () =>
  makeDataType([[[[0, 100, 0, 0]]]], {
    participantsSelections: [{ id: 1, name: 'Group', participantsIds: [0] }],
  })

// Second collection: S0 again (AOIs 'B', 'A' in its own order) plus a new T,
// recorded by a new participant Q who also saccades.
const second = () => {
  const segments = [[[[0, 100, 0, 1], [100, 200, 1, 0]]], [[[0, 50, 0]]]]
  return makeDataType(segments, {
    stimuli: { data: [['S0', 'S0'], ['T', 'T']], orderVector: [0, 1] },
    participants: { data: [['Q', 'Q']], orderVector: [0] },
    categories: { data: [['Fixation', 'Fixation', '#000000'], ['Saccade', 'Saccade', '#888888']], orderVector: [0, 1] },
    aois: { data: [[['B', 'B', '#00ff00'], ['A', 'A', '#ff0000']], [['C', 'C', '#0000ff']]], orderVector: [[0, 1], [0]] },
    participantsSelections: [{ id: 1, name: 'Group', participantsIds: [0] }],
    segments: jsonSegmentsToBinary(segments),
  })
}

describe('combining workspaces', () => {
  it('joins two collections: entities match by original name, ids remap into the first file', async () => {
    const layout = [{ id: 1, type: 'scarf', x: 0, y: 0, w: 4, h: 4, settings: { stimulusId: 0, hideNoAoi: false } }]
    const { engine, kind, warnings, gridItems } = await ingest([
      workspace('a.json', first(), layout),
      workspace('b.json', second()),
    ])
    const data = engine.toDataType()!

    expect(kind).toBe('workspace')
    expect(warnings).toEqual([])
    expect(gridItems).toEqual(layout)
    expect(data.stimuli.data.map(r => r[0])).toEqual(['S0', 'T'])
    expect(data.participants.data.map(r => r[0])).toEqual(['P0', 'Q'])
    expect(data.categories.data.map(r => r[0])).toEqual(['Fixation', 'Saccade'])
    expect(data.aois.data.map(rows => rows.map(r => r[0]))).toEqual([['A', 'B'], ['C']])
    // Q's 'A' hit is the first file's AOI 0, its 'B' the appended AOI 1.
    expect(nestedSegments(data)).toEqual([
      [[[0, 100, 0, 0]], [[0, 100, 0, 0], [100, 200, 1, 1]]],
      [[], [[0, 50, 0]]],
    ])
    // The second 'Group' is a different set of people, so it stays, renamed.
    expect(data.participantsSelections.filter(s => s.name.startsWith('Group'))).toEqual([
      { id: 1, name: 'Group', participantsIds: [0] },
      expect.objectContaining({ name: 'Group (2)', participantsIds: [1] }),
    ])
  })

  it('takes the earliest collection as the base, whatever the upload order', async () => {
    const b = second()
    b.participants.data = [['Q', 'P0']]
    const { engine } = await ingest([
      workspace('later.json', b, [], '2026-05-30T09:50:10.415Z'),
      workspace('earlier.json', first(), [], '2025-11-03T14:30:44.483Z'),
    ])
    const participants = engine.toDataType()!.participants
    expect(participants.orderVector.map(id => participants.data[id])).toEqual([['P0', 'P0'], ['Q', 'P0 (2)']])
  })

  it('refuses a recording both files hold', async () => {
    await expect(ingest([workspace('a.json', first()), workspace('b.json', first())])).rejects.toThrow(
      'b.json and a.json both hold P0 on S0'
    )
  })

  it('numbers a new recording shown under a name already loaded, never merging by name', async () => {
    const b = second()
    b.participants.data = [['Q', 'P0']]
    const { engine, warnings } = await ingest([workspace('a.json', first()), workspace('b.json', b)])
    expect(engine.toDataType()!.participants.data).toEqual([['P0', 'P0'], ['Q', 'P0 (2)']])
    expect(warnings).toEqual([expect.stringMatching(/^Participants in b\.json renamed P0 to P0 \(2\):/)])
  })

  it('refuses a non-workspace file alongside a workspace', async () => {
    const csv = new File(['participant,stimulus\n'], 'data.csv')
    await expect(ingest([workspace('a.json', first()), csv])).rejects.toThrow(
      'data.csv is not a GazePlotter workspace'
    )
  })
})
