import { describe, it, expect } from 'vitest'
import { defaultInstanceLabel } from '../src/lib/metrics'
import {
  paramToLabel,
  enumParam,
  boolParam,
  integerParam,
} from '../src/lib/metrics/core/params'

// ─── paramToLabel: the single rule every auto-label composes from ────────────

describe('paramToLabel', () => {
  const mode = enumParam('mode', 'Count mode', 'fixation', [
    { value: 'fixation', label: 'Fixation pairs' },
    { value: 'visit', label: 'Visit changes' },
  ])

  it('enum → the selected option label (always shown, incl. default)', () => {
    expect(paramToLabel(mode, 'fixation')).toBe('Fixation pairs')
    expect(paramToLabel(mode, 'visit')).toBe('Visit changes')
  })

  it('boolean → the param label when true, null when false', () => {
    const b = boolParam('flag', 'My flag', false)
    expect(paramToLabel(b, true)).toBe('My flag')
    expect(paramToLabel(b, false)).toBeNull()
  })

  it('boolean with toLabel → the custom short form', () => {
    const collapsed = boolParam('collapsed', 'Collapse consecutive AOIs', false, {
      toLabel: v => (v ? 'collapsed' : null),
    })
    expect(paramToLabel(collapsed, true)).toBe('collapsed')
    expect(paramToLabel(collapsed, false)).toBeNull()
  })

  it('numeric → omitted unless a toLabel opts in (e.g. step)', () => {
    const plain = integerParam('n', 'N', 1)
    expect(paramToLabel(plain, 5)).toBeNull()
    const step = integerParam('step', 'Step', 1, {
      toLabel: v => (v > 1 ? `${v}-step` : null),
    })
    expect(paramToLabel(step, 1)).toBeNull()
    expect(paramToLabel(step, 3)).toBe('3-step')
  })
})

// ─── defaultInstanceLabel: declarative composition, no per-metric callbacks ──

describe('defaultInstanceLabel (auto-resolved from params, mid-dot grammar)', () => {
  it('transition mode renders identically across every transition metric', () => {
    expect(defaultInstanceLabel('transitionCount', { mode: 'fixation' }))
      .toBe('Transitions · Fixation pairs')
    expect(defaultInstanceLabel('transitionCount', { mode: 'visit' }))
      .toBe('Transitions · Visit changes')
    expect(defaultInstanceLabel('transitionRelativeFrequency', { mode: 'fixation' }))
      .toBe('Transition relative frequency · Fixation pairs')
    expect(defaultInstanceLabel('transitionDwellSum', { mode: 'visit' }))
      .toBe('Transition dwell sum · Visit changes')
  })

  it('transitionProbability step is a qualifier shown only when > 1', () => {
    expect(defaultInstanceLabel('transitionProbability', { mode: 'fixation', step: 1 }))
      .toBe('Transition probability · Fixation pairs')
    expect(defaultInstanceLabel('transitionProbability', { mode: 'visit', step: 2 }))
      .toBe('Transition probability · Visit changes · 2-step')
  })

  it('similarity method + collapsed are mid-dot qualifiers (no parens)', () => {
    expect(defaultInstanceLabel('participantPairSimilarity', { method: 'levenshtein', collapsed: false }))
      .toBe('Scanpath similarity · Levenshtein')
    expect(defaultInstanceLabel('participantPairSimilarity', { method: 'needlemanWunsch', collapsed: true }))
      .toBe('Scanpath similarity · Needleman-Wunsch · collapsed')
  })

  it('param qualifiers precede the projection readout', () => {
    const label = defaultInstanceLabel(
      'transitionCount',
      { mode: 'visit' },
      { kind: 'matrix-aggregate', reducer: 'sum' }
    )
    expect(label.startsWith('Transitions · Visit changes · ')).toBe(true)
  })
})
