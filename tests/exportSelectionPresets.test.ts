import { describe, expect, it } from 'vitest'
import {
  isPresetSelected,
  presetSelectionSummary,
  togglePreset,
} from '$lib/modals/export/shared/presets'

const items = [
  { value: 'fix', label: 'Fixation' },
  { value: 'sac', label: 'Saccade' },
  { value: 'blink', label: 'Blink' },
]
const justFixations = { id: 1, name: 'Just fixations', members: ['fix'] }

describe('selection chips over an export checklist', () => {
  it('a chip ticks its members, and unticks them once all are ticked', () => {
    const ticked = togglePreset(['fix', 'sac'], new Set(['fix']))
    expect([...ticked].sort()).toEqual(['fix', 'sac'])
    expect(isPresetSelected(['fix', 'sac'], ticked)).toBe(true)
    expect([...togglePreset(['fix', 'sac'], ticked)]).toEqual([])
    expect(isPresetSelected([], new Set(['fix']))).toBe(false)
  })

  it('names an exact selection in the summary, else counts', () => {
    expect(presetSelectionSummary(items, [justFixations], new Set(['fix']))).toBe(
      'Just fixations (1)'
    )
    expect(presetSelectionSummary(items, [justFixations], new Set(['sac']))).toBe('Saccade')
    expect(presetSelectionSummary(items, [justFixations], new Set(['fix', 'sac']))).toBe(
      '2 of 3'
    )
    expect(
      presetSelectionSummary(items, [justFixations], new Set(['fix', 'sac', 'blink']))
    ).toBe('All (3)')
  })

  it('ignores ticks on items the list does not show', () => {
    expect(presetSelectionSummary(items, [justFixations], new Set(['fix', 'gone']))).toBe(
      'Just fixations (1)'
    )
    expect(
      presetSelectionSummary(items, [], new Set(['fix', 'sac', 'blink', 'gone']))
    ).toBe('All (3)')
  })
})
