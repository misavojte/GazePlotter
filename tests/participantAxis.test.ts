// Participants axis: selection id (unset/0/unknown = All) + hideEmptyParticipants; legacy groupId migration.
import { describe, expect, it } from 'vitest'
import { getParticipantsIds } from '$lib/data/engine'
import { runMigrations } from '../src/lib/data/ingest/workspace/migrations'
import { makeTestEngine } from './helpers/testEngine'

describe('getParticipantsIds', () => {
  // Stimulus 0: p1 has no recording. Selection 1 holds p2, p1 (stored out of order).
  const SEG = [0, 100, 0, 1]
  const engine = makeTestEngine([[[SEG], [], [SEG]]], {
    participantsSelections: [{ id: 1, name: 'Late', participantsIds: [2, 1] }],
  })
  const ids = (scope = {}) => getParticipantsIds(engine, scope, 0)

  it('narrows by selection and by data, alone or together, in participant order', () => {
    for (const id of [undefined, 0, 9]) expect(ids({ participantSelectionId: id })).toEqual([0, 1, 2])
    expect(ids({ participantSelectionId: 1 })).toEqual([1, 2])
    expect(ids({ hideEmptyParticipants: true })).toEqual([0, 2])
    expect(ids({ participantSelectionId: 1, hideEmptyParticipants: true })).toEqual([2])
  })
})

describe('participant axis migration', () => {
  const migrate = (rows: unknown[], groupIds: number[]): any =>
    runMigrations({
      version: 2,
      data: {
        stimuli: { data: [['S1']], orderVector: [0] },
        participants: { data: [['P1'], ['P2']], orderVector: [0, 1] },
        participantsGroups: rows,
        categories: { data: [['Fixation']], orderVector: [0] },
        aois: { data: [[]], orderVector: [[]] },
      },
      gridItems: groupIds.map((groupId, id) => ({ id, type: 'scarf', x: 0, y: 0, w: 8, h: 8, settings: { stimulusId: 0, groupId } })),
    })
  const settingsOf = (out: any) => out.gridItems.map(({ settings: { stimulusId, hideNoAoi, ...s } }: any) => s)

  it('maps -1 to All, -2 to hideEmptyParticipants, an id to participantSelectionId', () => {
    expect(settingsOf(migrate([{ id: 3, name: 'G', participantsIds: [1] }], [-1, -2, 3]))).toEqual([
      { hideEmptyParticipants: false },
      { hideEmptyParticipants: true },
      { participantSelectionId: 3, hideEmptyParticipants: false },
    ])
  })

  it('renumbers an id-0 row (now All) past every id in use, idempotently', () => {
    const out = migrate([{ id: 0, name: 'Group 1', participantsIds: [1] }], [0, 4])
    expect(out.data.participantsSelections[0].id).toBe(5)
    expect(settingsOf(out).map((s: any) => s.participantSelectionId)).toEqual([5, 4])
    const again = runMigrations(structuredClone(out)) as any
    expect(again.gridItems).toEqual(out.gridItems)
    expect(again.data.participantsSelections).toEqual(out.data.participantsSelections)
  })
})
