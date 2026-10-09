import { describe, expect, it } from 'vitest'
import { createGroupedEntityEditor } from '../src/lib/modals/modification/shared/groupedEntityEditor.svelte'
import type { ExtendedInterpretedDataType } from '$lib/data/types'

/**
 * `touched` is the editor's per-field record of what the user EDITED since
 * open/refresh — distinct from "value differs". The AOI modal's all-stimuli
 * scope reads it to unify divergent per-stimulus values to the value shown
 * (re-picking the same color), and must never see a field the user did not
 * edit (a bulk rename that misses a row, a sort, a drag).
 */

const row = (
  id: number,
  displayedName: string,
  color = '#000000',
  originalName = displayedName
): ExtendedInterpretedDataType => ({ id, originalName, displayedName, color })

const seed = () => [
  row(0, 'A'),
  row(1, 'B'),
  row(2, 'C', '#111111'),
  row(3, 'C', '#222222', 'C2'),
]

const make = () => createGroupedEntityEditor({ getItems: () => seed() })

describe('groupedEntityEditor touched fields', () => {
  it('starts clean', () => {
    const ed = make()
    expect(ed.touched.name.size).toBe(0)
    expect(ed.touched.color.size).toBe(0)
  })

  it('marks the color of every member of the card, even when re-picking the same value', () => {
    const ed = make()
    const card = ed.groups.find(g => g.members.length === 2)!
    ed.handleColorInput(card, '#111111') // C's current color
    expect([...ed.touched.color].sort()).toEqual([2, 3])
    expect(ed.touched.name.size).toBe(0)
  })

  it('marks exactly the rows a rename wrote (leader fan-out across the card)', () => {
    const ed = make()
    const single = ed.groups.find(g => g.members[0].id === 0)!
    ed.handleNameInput(single.members[0], 'A2', true, single)
    expect([...ed.touched.name]).toEqual([0])

    const card = ed.groups.find(g => g.members.length === 2)!
    ed.handleNameInput(card.members[0], 'D', true, card)
    expect([...ed.touched.name].sort()).toEqual([0, 2, 3])
    expect(ed.touched.color.size).toBe(0)
  })

  it('marks a bulk rename only on rows whose name actually changed', () => {
    const ed = make()
    ed.renameAll('^C$', 'Z')
    expect([...ed.touched.name].sort()).toEqual([2, 3])
    ed.renameAll('nomatch', 'Q')
    expect([...ed.touched.name].sort()).toEqual([2, 3])
  })

  it('leaves both sets alone on sort and drag reorder', () => {
    const ed = make()
    ed.sort('displayedName', 'desc')
    ed.reorderGroups(0, 2)
    expect(ed.touched.name.size).toBe(0)
    expect(ed.touched.color.size).toBe(0)
  })

  it('clears both sets on refresh', () => {
    const ed = make()
    const card = ed.groups[0]
    ed.handleColorInput(card, '#abcdef')
    ed.handleNameInput(card.members[0], 'X', true, card)
    ed.refresh()
    expect(ed.touched.name.size).toBe(0)
    expect(ed.touched.color.size).toBe(0)
  })

  it('un-touches names reverted by acknowledging an invalid group', () => {
    const ed = createGroupedEntityEditor({
      getItems: () => seed(),
      lockedNameIds: new Set([0]),
    })
    // Fold B into the locked name A (an invalid card); acknowledging it
    // reverts B to its open name, so B is no longer an edit.
    const b = ed.groups.find(g => g.members[0].id === 1)!
    ed.handleNameInput(b.members[0], 'A', true, b)
    expect(ed.items.find(i => i.id === 1)?.displayedName).toBe('A')
    expect(ed.touched.name.has(1)).toBe(true)
    const card = {
      id: 0,
      members: ed.items.filter(i => i.id === 0 || i.id === 1),
    }
    ed.acknowledge(card)
    expect(ed.items.find(i => i.id === 1)?.displayedName).toBe('B')
    expect(ed.touched.name.has(1)).toBe(false)
  })
})
