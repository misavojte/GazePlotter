import { describe, expect, it } from 'vitest'
import { linkedHighlightUpdates, type HighlightTarget } from '$lib/plots/shared/highlightLink'
import { scarfPlotDefinition } from '$lib/plots/scarf/definition'
import { aoiStreamPlotDefinition } from '$lib/plots/aoi-stream/definition'
import { calculateHighlightMask } from '$lib/plots/scarf/core/transformer'

import { aoiComparisonDefinition } from '$lib/plots/aoi-comparison/definition'
import { eventComparisonDefinition } from '$lib/plots/event-comparison/definition'
import { eyeMovementComparisonDefinition } from '$lib/plots/eye-movement-comparison/definition'

const scarf = scarfPlotDefinition.highlights!
const stream = aoiStreamPlotDefinition.highlights!
const aoiComparison = aoiComparisonDefinition.highlights!
const eventComparison = eventComparisonDefinition.highlights!
const typeComparison = eyeMovementComparisonDefinition.highlights!

describe('comparison plot highlights', () => {
  const s = { stimulusId: 2 } as never
  const viaScarf = (spec: HighlightTarget['spec'], id: string) => spec.local(scarf.share(id, s)!, s)
  const toScarf = (spec: HighlightTarget['spec'], id: string) => scarf.local(spec.share(id, s)!, s)

  it('link each comparison to the Scarf legend item of the same entity', () => {
    expect(viaScarf(aoiComparison, 'a12')).toBe('12')
    expect(viaScarf(aoiComparison, 'aN')).toBe('-1')
    expect(toScarf(aoiComparison, '-1')).toBe('aN')
    expect(viaScarf(eventComparison, 'e4')).toBe('4')
    expect(toScarf(eventComparison, '4')).toBe('e4')
    expect(viaScarf(typeComparison, 'ac3')).toBe('3')
    expect(toScarf(typeComparison, '3')).toBe('ac3')
  })

  it('take only their own kind', () => {
    expect(viaScarf(aoiComparison, 'e4')).toBeNull()
    expect(viaScarf(eventComparison, 'a12')).toBeNull()
    expect(viaScarf(eventComparison, 'aN')).toBeNull()
    expect(viaScarf(typeComparison, 'a12')).toBeNull()
    // Types are global; events stay on their stimulus.
    expect(typeComparison.local({ entity: 'category:3', stimulusId: null }, { stimulusId: 9 } as never)).toBe('3')
    expect(eventComparison.local({ entity: 'event:4', stimulusId: 2 }, { stimulusId: 9 } as never)).toBeNull()
  })
})

const target = (
  id: number,
  spec: HighlightTarget['spec'],
  stimulusId: number,
  highlights: string[] = []
): HighlightTarget => ({ id, spec, settings: { stimulusId, highlights } })

describe('linked legend highlights', () => {
  it('maps Scarf and AOI Timeline identifiers onto one entity', () => {
    const s = { stimulusId: 2 }
    expect(scarf.share('a12', s as never)).toEqual({ entity: 'aoi:12', stimulusId: 2 })
    expect(stream.local({ entity: 'aoi:12', stimulusId: 2 }, s as never)).toBe('12')
    expect(stream.local(stream.share('-1', s as never)!, s as never)).toBe('-1')
    expect(scarf.local(stream.share('-1', s as never)!, s as never)).toBe('aN')
    // Categories are global; the AOI Timeline has none to show.
    expect(scarf.share('ac3', s as never)).toEqual({ entity: 'category:3', stimulusId: null })
    expect(stream.local({ entity: 'category:3', stimulusId: null }, s as never)).toBeNull()
  })

  it('sets the clicked state in the other plots, one update each', () => {
    const updates = linkedHighlightUpdates(target(1, scarf, 2), 'a12', [
      target(2, stream, 2),
      target(3, stream, 2, ['12']),
      target(4, stream, 5),
    ])
    // Plot 3 already has it, plot 4 is on another stimulus.
    expect(updates).toEqual([
      { itemId: 1, settings: { highlights: ['a12'] } },
      { itemId: 2, settings: { highlights: ['12'] } },
    ])
  })

  it('clears it everywhere when the clicked plot turns it off', () => {
    const updates = linkedHighlightUpdates(target(1, stream, 2, ['12', '3']), '12', [
      target(2, scarf, 2, ['a12', 'ac1']),
    ])
    expect(updates).toEqual([
      { itemId: 1, settings: { highlights: ['3'] } },
      { itemId: 2, settings: { highlights: ['ac1'] } },
    ])
  })

  it('carries a category to a Scarf on another stimulus', () => {
    const updates = linkedHighlightUpdates(target(1, scarf, 2), 'ac3', [target(2, scarf, 7)])
    expect(updates[1]).toEqual({ itemId: 2, settings: { highlights: ['ac3'] } })
  })

  it('dims nothing in a Scarf that does not draw the highlighted AOI', () => {
    const system = { idToIndex: new Map([['a1', 0]]), totalIdentifiers: 1 }
    expect(calculateHighlightMask(['a12'], system)).toBeNull()
    expect(calculateHighlightMask(['a12', 'a1'], system)).toEqual(new Uint8Array([1]))
  })
})
