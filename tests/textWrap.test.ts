import { describe, it, expect } from 'vitest'
import { wrapTextToWidth } from '../src/lib/shared/utils/textUtils'

describe('wrapTextToWidth', () => {
  it('returns [] for empty/blank text', () => {
    expect(wrapTextToWidth('', 100, 12)).toEqual([])
    expect(wrapTextToWidth('   ', 100, 12)).toEqual([])
  })

  it('keeps text on one line when it fits the width', () => {
    expect(wrapTextToWidth('Transition probability / %', 100000, 12)).toEqual([
      'Transition probability / %',
    ])
  })

  it('breaks every word onto its own line when the width is tiny', () => {
    // width=1 forces a break after each word, but a single word is never split.
    expect(wrapTextToWidth('aa bb cc', 1, 12)).toEqual(['aa', 'bb', 'cc'])
  })

  it('never splits a single over-wide word (keeps it whole on its line)', () => {
    expect(wrapTextToWidth('superlongunbreakableword', 1, 12)).toEqual([
      'superlongunbreakableword',
    ])
  })

  it('caps at maxLines, collapsing the overflow into an ellipsised last line', () => {
    const lines = wrapTextToWidth('aa bb cc dd ee ff', 1, 12, undefined, 2)
    expect(lines.length).toBeLessThanOrEqual(2)
    expect(lines[lines.length - 1].endsWith('…')).toBe(true)
  })
})
