import { describe, expect, it } from 'vitest'
import {
  allStimuliRenamePairs,
  buildAllStimuliUnion,
  planAllStimuliUpdates,
  resolveAllStimuliEdits,
  type StimulusAois,
  type Touched,
} from '../src/lib/modals/modification/aoi-modification/allStimuli'
import { buildRenameMap } from '../src/lib/modals/modification/shared/nameKeyedSelection'
import type { ExtendedInterpretedDataType } from '$lib/data/types'

/**
 * The AOI modal's "All stimuli" scope as pure functions. The reported bug: on
 * a large dataset a bulk color edit did not land in every stimulus (per-
 * stimulus root commands, undo-cap eviction) and, because name and color
 * travelled as one bundle, a color-only edit rewrote divergent per-stimulus
 * names. These pins cover the union, the per-field edit predicate, the plan,
 * and the rename pairs selections follow.
 */

const aoi = (
  id: number,
  originalName: string,
  color: string,
  displayedName = originalName
): ExtendedInterpretedDataType => ({ id, originalName, displayedName, color })

const stim = (
  stimulusId: number,
  ...aois: ExtendedInterpretedDataType[]
): StimulusAois => ({
  stimulusId,
  aois,
})

const none: Touched = { name: new Set(), color: new Set() }
const touch = (over: { name?: number[]; color?: number[] }): Touched => ({
  name: new Set(over.name ?? []),
  color: new Set(over.color ?? []),
})

// Face is red in S0, blue in S1 (divergent); Nose only in S0; Mouth only in S2.
const divergent = (): StimulusAois[] => [
  stim(0, aoi(0, 'Face', '#ff0000'), aoi(1, 'Nose', '#00ff00')),
  stim(1, aoi(0, 'Face', '#0000ff')),
  stim(2, aoi(0, 'Mouth', '#ffff00')),
]

describe('buildAllStimuliUnion', () => {
  it('yields one row per original name with first-seen values and identity ids', () => {
    const { rows, init } = buildAllStimuliUnion(divergent())
    expect(rows.map(r => [r.id, r.originalName, r.color])).toEqual([
      [0, 'Face', '#ff0000'],
      [1, 'Nose', '#00ff00'],
      [2, 'Mouth', '#ffff00'],
    ])
    expect(init.get('Face')).toEqual({
      displayedName: 'Face',
      color: '#ff0000',
    })
  })

  it('labels n/total and flags * only when a later stimulus differs in name or color', () => {
    const { rows } = buildAllStimuliUnion(divergent())
    expect(rows.map(r => r.stimuliLabel)).toEqual(['2/3*', '1/3', '1/3'])
  })

  it('does not flag * for a hex-case-only color difference', () => {
    const { rows } = buildAllStimuliUnion([
      stim(0, aoi(0, 'Face', '#FF0000')),
      stim(1, aoi(0, 'Face', '#ff0000')),
    ])
    expect(rows[0].stimuliLabel).toBe('2/2')
  })

  it('collects every distinct trimmed displayed name per original name', () => {
    const { openNames } = buildAllStimuliUnion([
      stim(0, aoi(0, 'Face', '#ff0000', 'Face')),
      stim(1, aoi(0, 'Face', '#ff0000', 'Face-B ')),
      stim(2, aoi(0, 'Face', '#ff0000', '')),
    ])
    expect([...openNames.get('Face')!]).toEqual(['Face', 'Face-B'])
  })
})

describe('resolveAllStimuliEdits', () => {
  const init = buildAllStimuliUnion(divergent()).init
  const cleaned = () => buildAllStimuliUnion(divergent()).rows

  it('reports nothing for untouched, unchanged rows', () => {
    expect(resolveAllStimuliEdits(cleaned(), init, none).size).toBe(0)
  })

  it('reports ONLY the color when only the color changed', () => {
    const rows = cleaned()
    rows[0].color = '#123456'
    expect([...resolveAllStimuliEdits(rows, init, none)]).toEqual([
      ['Face', { color: '#123456' }],
    ])
  })

  it('reports ONLY the name when only the name changed (trimmed)', () => {
    const rows = cleaned()
    rows[0].displayedName = ' Head '
    expect([...resolveAllStimuliEdits(rows, init, none)]).toEqual([
      ['Face', { displayedName: 'Head' }],
    ])
  })

  it('treats a touched field as edited even when its value equals the shown one', () => {
    expect([
      ...resolveAllStimuliEdits(cleaned(), init, touch({ color: [0] })),
    ]).toEqual([['Face', { color: '#ff0000' }]])
    expect([
      ...resolveAllStimuliEdits(cleaned(), init, touch({ name: [1] })),
    ]).toEqual([['Nose', { displayedName: 'Nose' }]])
  })

  it('ignores a hex-case-only color difference when untouched', () => {
    const rows = cleaned()
    rows[0].color = '#FF0000'
    expect(resolveAllStimuliEdits(rows, init, none).size).toBe(0)
  })
})

describe('planAllStimuliUpdates', () => {
  const plan = (
    perStimulus: StimulusAois[],
    mutate: (
      rows: ExtendedInterpretedDataType[]
    ) => ExtendedInterpretedDataType[] | void,
    touched: Touched = none
  ) => {
    const union = buildAllStimuliUnion(perStimulus)
    const rows = mutate(union.rows) ?? union.rows
    const edits = resolveAllStimuliEdits(rows, union.init, touched)
    return planAllStimuliUpdates(perStimulus, rows, edits)
  }

  it('applies a color-only edit to EVERY stimulus with the original name, keeping each name', () => {
    const data = divergent()
    data[1].aois[0].displayedName = 'Face (right)' // divergent per-stimulus rename
    const updates = plan(data, rows => {
      rows[0].color = '#123456'
    })
    expect(updates).toEqual([
      {
        stimulusId: 0,
        aois: [aoi(0, 'Face', '#123456'), aoi(1, 'Nose', '#00ff00')],
      },
      {
        stimulusId: 1,
        aois: [aoi(0, 'Face', '#123456', 'Face (right)')],
      },
    ])
  })

  it('applies a name-only edit everywhere and keeps each stimulus color', () => {
    const updates = plan(divergent(), rows => {
      rows[0].displayedName = 'Head'
    })
    expect(updates).toEqual([
      {
        stimulusId: 0,
        aois: [aoi(0, 'Face', '#ff0000', 'Head'), aoi(1, 'Nose', '#00ff00')],
      },
      { stimulusId: 1, aois: [aoi(0, 'Face', '#0000ff', 'Head')] },
    ])
  })

  it('unifies a divergent row to the shown color when the color was touched but not changed', () => {
    const updates = plan(divergent(), () => {}, touch({ color: [0] }))
    // S0 already has the color, so only S1 changes.
    expect(updates).toEqual([
      { stimulusId: 1, aois: [aoi(0, 'Face', '#ff0000')] },
    ])
  })

  it('leaves untouched divergent rows alone (empty plan)', () => {
    expect(plan(divergent(), () => {})).toEqual([])
  })

  it('copies an unedited name verbatim, whitespace included, on a color-only edit', () => {
    const data = [stim(0, aoi(0, 'Face', '#ff0000', ' Face '))]
    const updates = plan(data, rows => {
      rows[0].color = '#123456'
    })
    expect(updates[0].aois[0].displayedName).toBe(' Face ')
  })

  it('edits both rows sharing an original name inside one stimulus, keeping their order', () => {
    const data = [
      stim(
        0,
        aoi(0, 'X', '#111111'),
        aoi(1, 'X', '#222222', 'Y'),
        aoi(2, 'Z', '#333333')
      ),
    ]
    const updates = plan(data, rows => {
      rows[0].color = '#abcdef'
    })
    expect(updates).toEqual([
      {
        stimulusId: 0,
        aois: [
          aoi(0, 'X', '#abcdef'),
          aoi(1, 'X', '#abcdef', 'Y'),
          aoi(2, 'Z', '#333333'),
        ],
      },
    ])
  })

  it('makes every stimulus adopt a rearranged union order, including value-unchanged ones', () => {
    const data = [
      stim(0, aoi(0, 'A', '#1'), aoi(1, 'B', '#2'), aoi(2, 'C', '#3')),
      stim(1, aoi(0, 'A', '#1'), aoi(1, 'B', '#2')),
      stim(2, aoi(0, 'B', '#2'), aoi(1, 'A', '#1')), // already in the shared order → omitted
      stim(3, aoi(0, 'C', '#3')), // single row: nothing to reorder → omitted
    ]
    const updates = plan(data, rows => [rows[2], rows[1], rows[0]]) // C, B, A
    expect(updates.map(u => [u.stimulusId, u.aois.map(a => a.id)])).toEqual([
      [0, [2, 1, 0]],
      [1, [1, 0]],
    ])
    expect(new Set(updates.map(u => u.stimulusId)).size).toBe(updates.length)
  })

  it('does not touch a stimulus that lacks the edited original name', () => {
    const updates = plan(divergent(), rows => {
      rows[1].color = '#000001' // Nose: only in S0
    })
    expect(updates.map(u => u.stimulusId)).toEqual([0])
  })

  it('covers all 60 stimuli of a large dataset with one color edit', () => {
    const data = Array.from({ length: 60 }, (_, s) =>
      stim(
        s,
        aoi(0, 'A', `#${s.toString(16).padStart(6, '0')}`),
        aoi(1, `Only${s}`, '#ffffff')
      )
    )
    const updates = plan(data, rows => {
      rows[0].color = '#00ff00'
    })
    expect(updates).toHaveLength(60)
    for (const u of updates) {
      expect(u.aois[0]).toEqual(aoi(0, 'A', '#00ff00'))
      expect(u.aois[1].color).toBe('#ffffff')
    }
  })
})

describe('allStimuliRenamePairs', () => {
  it('maps every per-stimulus displayed name of a renamed original to the new name', () => {
    const data = [
      stim(0, aoi(0, 'Face', '#ff0000', 'Face')),
      stim(1, aoi(0, 'Face', '#ff0000', 'Face-B')),
    ]
    const union = buildAllStimuliUnion(data)
    const rows = union.rows
    rows[0].displayedName = 'Head'
    const edits = resolveAllStimuliEdits(rows, union.init, none)
    const map = buildRenameMap(allStimuliRenamePairs(union, edits))
    expect(Object.fromEntries(map)).toEqual({ Face: 'Head', 'Face-B': 'Head' })
  })

  it('does not capture a divergent name still live on an unedited original', () => {
    const data = [
      stim(
        0,
        aoi(0, 'Face', '#ff0000', 'Face'),
        aoi(1, 'Eye', '#00ff00', 'Face-B')
      ),
      stim(1, aoi(0, 'Face', '#ff0000', 'Face-B')),
    ]
    const union = buildAllStimuliUnion(data)
    const rows = union.rows
    rows[0].displayedName = 'Head'
    const edits = resolveAllStimuliEdits(rows, union.init, none)
    const map = buildRenameMap(allStimuliRenamePairs(union, edits))
    // Face-B stays: Eye still shows it on S0, so a selection holding it keeps matching.
    expect(Object.fromEntries(map)).toEqual({ Face: 'Head' })
  })

  it('yields no renames when nothing was edited', () => {
    const union = buildAllStimuliUnion(divergent())
    const edits = resolveAllStimuliEdits(union.rows, union.init, none)
    expect(buildRenameMap(allStimuliRenamePairs(union, edits)).size).toBe(0)
  })
})
