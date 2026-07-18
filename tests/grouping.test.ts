import { describe, it, expect } from 'vitest'
import { groupByDisplayedName } from '$lib/data/engine/utils/grouping'
import { createBaseGroupEditor } from '../src/lib/modals/modification/shared/groupedEntityEditor.svelte'
import type {
  BaseInterpretedDataType,
  ExtendedInterpretedDataType,
} from '$lib/data/types'

/**
 * `groupByDisplayedName` is the single "same displayed name = same entity" rule.
 * M1 relaxed its bound from `ExtendedInterpretedDataType` (color-bearing: AOIs,
 * categories, event channels) to the structural `{ id; displayedName }`, so the
 * stimulus/participant merge feature can reuse the exact same rule on
 * `BaseInterpretedDataType` (no color). These tests pin BOTH that the original
 * Extended behavior is unchanged AND that it now works on Base entities.
 */

const aoi = (
  id: number,
  displayedName: string,
  color = '#000000',
  originalName = displayedName
): ExtendedInterpretedDataType => ({ id, originalName, displayedName, color })

const base = (
  id: number,
  displayedName: string,
  originalName = displayedName
): BaseInterpretedDataType => ({ id, originalName, displayedName })

describe('groupByDisplayedName', () => {
  it('returns [] for empty input', () => {
    expect(groupByDisplayedName([])).toEqual([])
  })

  describe('Extended entities (AOIs / categories / channels) — behavior unchanged', () => {
    it('merges same-displayed-name entries, keeping the first as representative', () => {
      const items = [
        aoi(0, 'Logo', '#ff0000'),
        aoi(1, 'Text', '#00ff00'),
        aoi(2, 'Logo', '#0000ff'),
      ]
      const groups = groupByDisplayedName(items)

      expect(groups).toHaveLength(2)
      // First occurrence (id 0) is the representative and keeps its own color;
      // the later same-named id 2 is folded in via memberIds (non-adjacent).
      expect(groups[0]).toMatchObject({
        id: 0,
        displayedName: 'Logo',
        color: '#ff0000',
        memberIds: [0, 2],
      })
      expect(groups[1]).toMatchObject({
        id: 1,
        displayedName: 'Text',
        memberIds: [1],
      })
    })

    it('preserves first-occurrence order of the groups', () => {
      const items = [aoi(0, 'B'), aoi(1, 'A'), aoi(2, 'B'), aoi(3, 'A')]
      const groups = groupByDisplayedName(items)
      expect(groups.map(g => g.displayedName)).toEqual(['B', 'A'])
      expect(groups.map(g => g.memberIds)).toEqual([
        [0, 2],
        [1, 3],
      ])
    })

    it('trims whitespace before comparing names', () => {
      const groups = groupByDisplayedName([aoi(0, 'Logo'), aoi(1, ' Logo ')])
      expect(groups).toHaveLength(1)
      expect(groups[0].memberIds).toEqual([0, 1])
    })

    it('never merges empty-displayed-name entries', () => {
      const groups = groupByDisplayedName([aoi(0, ''), aoi(1, ''), aoi(2, '  ')])
      expect(groups).toHaveLength(3)
      expect(groups.map(g => g.memberIds)).toEqual([[0], [1], [2]])
    })

    it('carries the representative color/originalName through', () => {
      const groups = groupByDisplayedName([
        aoi(0, 'Area', '#123456', 'Area_v1'),
        aoi(1, 'Area', '#abcdef', 'Area_v2'),
      ])
      expect(groups[0].color).toBe('#123456')
      expect(groups[0].originalName).toBe('Area_v1')
    })
  })

  describe('Base entities (stimuli / participants) — enabled by the relaxed bound', () => {
    it('groups color-less Base entities by displayed name', () => {
      // The import-split case: "A (copy)" renamed to displayed "A" folds into "A".
      const stimuli = [
        base(0, 'A', 'Stimulus A'),
        base(1, 'A', 'Stimulus A (copy)'),
        base(2, 'B', 'Stimulus B'),
      ]
      const groups = groupByDisplayedName(stimuli)

      expect(groups).toHaveLength(2)
      expect(groups[0]).toMatchObject({
        id: 0,
        displayedName: 'A',
        originalName: 'Stimulus A',
        memberIds: [0, 1],
      })
      expect(groups[1]).toMatchObject({ id: 2, memberIds: [2] })
      // No `color` invented on a Base group.
      expect('color' in groups[0]).toBe(false)
    })

    it('leaves distinct-named Base entities standalone (the between-subjects case)', () => {
      const participants = [base(0, 'P1'), base(1, 'P2'), base(2, 'P3')]
      const groups = groupByDisplayedName(participants)
      expect(groups).toHaveLength(3)
      expect(groups.map(g => g.memberIds)).toEqual([[0], [1], [2]])
    })
  })

  describe('equivalence: identical grouping regardless of the color field', () => {
    it('Base and Extended entities with the same ids/names produce the same grouping shape', () => {
      const names: Array<[number, string]> = [
        [0, 'X'],
        [1, 'Y'],
        [2, 'X'],
      ]
      const baseGroups = groupByDisplayedName(names.map(([id, n]) => base(id, n)))
      const extGroups = groupByDisplayedName(names.map(([id, n]) => aoi(id, n)))
      expect(baseGroups.map(g => ({ id: g.id, memberIds: g.memberIds }))).toEqual(
        extGroups.map(g => ({ id: g.id, memberIds: g.memberIds }))
      )
    })
  })

  describe('createBaseGroupEditor live merge model', () => {
    const seed = (): BaseInterpretedDataType[] => [
      { id: 0, originalName: 'S0', displayedName: 'A' },
      { id: 1, originalName: 'S1', displayedName: 'B' },
    ]

    const renamed = (id: number): BaseInterpretedDataType => ({
      id,
      originalName: `S${id}`,
      displayedName: '',
    })

    it('forms a clean, mergeable group with no conflict', () => {
      const ed = createBaseGroupEditor(seed(), { detectConflicts: () => [] })
      ed.handleNameInput(renamed(1), 'A', false, { id: 1, members: [renamed(1)] })
      expect(ed.hasGroups).toBe(true)
      expect(ed.hasInvalidGroup).toBe(false)
      const group = ed.groups.find(g => g.members.length > 1)!
      expect(ed.conflictsFor(group)).toEqual([])
    })

    it('keeps the typed name but flags an overlapping group (blocks Apply)', () => {
      const ed = createBaseGroupEditor(seed(), { detectConflicts: () => [5] })
      ed.handleNameInput(renamed(1), 'A', false, { id: 1, members: [renamed(1)] })
      expect(ed.getItems().find(i => i.id === 1)?.displayedName).toBe('A')
      const group = ed.groups.find(g => g.members.length > 1)!
      expect(ed.conflictsFor(group)).toEqual([5])
      expect(ed.hasInvalidGroup).toBe(true)
    })

    it('acknowledge returns the group to its former names and clears the block', () => {
      const ed = createBaseGroupEditor(seed(), { detectConflicts: () => [5] })
      ed.handleNameInput(renamed(1), 'A', false, { id: 1, members: [renamed(1)] })
      const group = ed.groups.find(g => g.members.length > 1)!
      ed.acknowledge(group)
      expect(ed.getItems().map(i => i.displayedName)).toEqual(['A', 'B'])
      expect(ed.hasInvalidGroup).toBe(false)
    })
  })
})
