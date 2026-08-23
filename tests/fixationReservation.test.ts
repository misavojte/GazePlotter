/**
 * The Fixation name reservation: id 0 is the substrate every AOI metric and
 * the scarf's AOI layer scan, so its displayed name is a locked identity
 * anchor. Three layers of the guard, each pinned here:
 *   1. the grouped editor (modal): id 0 never renames, and a row renamed
 *      into the reserved name flags an invalid group (Apply-blocking) that
 *      `acknowledge` dissolves;
 *   2. the engine updater: `updateCategories` preserves the fixation row's
 *      names and refuses reserved-name collisions, keeping the invariant
 *      total even past the modal;
 *   3. workspace load: the validator heals files carrying a second row
 *      displayed as the reserved name (suffix rename), so the display fold
 *      can never silently claim a type is the fixation baseline.
 */
import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { updateCategories } from '../src/lib/data/engine'
import { processAndValidateData } from '../src/lib/data/ingest/workspace/validator'
import { createGroupedEntityEditor } from '../src/lib/modals/modification/shared/groupedEntityEditor.svelte'
import type { ExtendedInterpretedDataType } from '../src/lib/data/types'

const CATEGORIES = [
  ['Fixation', 'Fixation', '#000000'],
  ['Saccade', 'Saccade', '#111111'],
  ['Blink', 'Blink', '#222222'],
]

const SEGMENTS = [[], [[[0, 100, 0, 1], [100, 150, 1], [150, 200, 2]]]]

function createEngine() {
  return makeTestEngine(SEGMENTS, { categories: CATEGORIES })
}

const cat = (
  id: number,
  originalName: string,
  displayedName: string,
  color = '#123456'
): ExtendedInterpretedDataType => ({ id, originalName, displayedName, color })

describe('updateCategories guard (engine layer)', () => {
  it('preserves the fixation row names; only its color follows the edit', () => {
    const engine = createEngine()
    updateCategories(engine, [
      cat(0, 'Renamed', 'Renamed', '#ff0000'),
      cat(1, 'Saccade', 'Saccade', '#111111'),
      cat(2, 'Blink', 'Blink', '#222222'),
    ])
    expect(engine.metadata!.categories.data[0]).toEqual([
      'Fixation',
      'Fixation',
      '#ff0000',
    ])
  })

  it('refuses giving another row the reserved displayed name', () => {
    const engine = createEngine()
    updateCategories(engine, [
      cat(0, 'Fixation', 'Fixation', '#000000'),
      cat(1, 'Saccade', 'Fixation', '#111111'),
      cat(2, 'Blink', 'Blink', '#222222'),
    ])
    expect(engine.metadata!.categories.data[1]).toEqual([
      'Saccade',
      'Saccade',
      '#111111',
    ])
  })
})

describe('validator heal (workspace load layer)', () => {
  it('suffix-renames rows that collide with the fixation row displayed name', () => {
    const payload = {
      stimuli: { data: [['s0', 's0']], orderVector: [0] },
      participants: { data: [['p0', 'p0']], orderVector: [0] },
      categories: {
        data: [
          ['Fixation', 'Fixation', '#000000'],
          ['Saccade', 'Fixation', '#111111'],
          ['Blink', 'Blink', '#222222'],
        ],
        orderVector: [0, 1, 2],
      },
      aois: { data: [[]], orderVector: [[]] },
      participantsGroups: [],
      segments: [[[[0, 100, 0]]]],
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = processAndValidateData(payload as any)
    expect(result.categories.data[1]?.[1]).toBe('Fixation (2)')
    expect(result.categories.data[2]?.[1]).toBe('Blink')
    expect(result.categories.data[0]?.[1]).toBe('Fixation')
  })
})

describe('grouped editor lock (modal layer)', () => {
  const makeEditor = () =>
    createGroupedEntityEditor({
      getItems: () => [
        cat(0, 'Fixation', 'Fixation', '#000000'),
        cat(1, 'Saccade', 'Saccade', '#111111'),
        cat(2, 'Blink', 'Blink', '#222222'),
      ],
      lockedNameIds: new Set([0]),
    })

  it('the locked row never renames (covers the tray Merge fold too)', () => {
    const editor = makeEditor()
    const fixation = editor.items.find(i => i.id === 0)!
    const group = editor.groups.find(g => g.id === 0)!
    editor.handleNameInput(fixation, 'Gaze', true, group)
    expect(editor.items.find(i => i.id === 0)!.displayedName).toBe('Fixation')
  })

  it('renaming another row into the reserved name flags an invalid group; acknowledge dissolves it', () => {
    const editor = makeEditor()
    const saccade = editor.items.find(i => i.id === 1)!
    const saccadeGroup = editor.groups.find(g => g.id === 1)!
    editor.handleNameInput(saccade, 'Fixation', true, saccadeGroup)

    // The fold puts id 0 and id 1 on one card — invalid while it exists.
    const folded = editor.groups.find(g =>
      g.members.some(m => m.id === 0)
    )!
    expect(folded.members.map(m => m.id).sort()).toEqual([0, 1])
    expect(editor.conflictsFor(folded)).toEqual([1])
    expect(editor.hasInvalidGroup).toBe(true)

    editor.acknowledge(folded)
    expect(editor.items.find(i => i.id === 1)!.displayedName).toBe('Saccade')
    expect(editor.hasInvalidGroup).toBe(false)
  })

  it('bulk find/replace skips the locked row', () => {
    const editor = makeEditor()
    editor.renameAll('a', 'X')
    expect(editor.items.find(i => i.id === 0)!.displayedName).toBe('Fixation')
    expect(editor.items.find(i => i.id === 1)!.displayedName).toBe('SXccXde')
  })
})
