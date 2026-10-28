import { describe, expect, it } from 'vitest'
import { linearTicks } from '$lib/plots/shared/ticks'

describe('linearTicks labels share one precision per axis', () => {
  it('pixel scale: whole numbers, zero included', () => {
    expect(linearTicks(0, 1080, 5).labels).toEqual(['0', '250', '500', '750', '1000'])
  })
  it('a 2.5 step gets one decimal on every tick', () => {
    expect(linearTicks(0, 10, 5).labels).toEqual(['0.0', '2.5', '5.0', '7.5', '10.0'])
  })
  it('normalized scale: two decimals on every tick', () => {
    expect(linearTicks(0, 1, 5).labels).toEqual(['0.00', '0.25', '0.50', '0.75', '1.00'])
  })
  it('negative minimum keeps the same precision', () => {
    expect(linearTicks(-500, 500, 5).labels).toEqual(['-500', '-250', '0', '250', '500'])
  })
})
