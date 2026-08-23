import { describe, it, expect } from 'vitest'
import { distanceToSegment } from '$lib/plots/scanpath-similarity/core/forceLayout'

// Hit-testing a drawn link: the ends must be CAPS, not an infinite line, or a
// pointer far past an endpoint would resolve to that edge.
describe('distanceToSegment', () => {
  it('measures perpendicular distance beside the segment', () => {
    expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBe(3)
    expect(distanceToSegment(0, 0, 0, -4, 0, 4)).toBe(0)
  })

  it('clamps past either end instead of extending the line', () => {
    // On the infinite line these would read 0; as a segment they are 5 away.
    expect(distanceToSegment(15, 0, 0, 0, 10, 0)).toBe(5)
    expect(distanceToSegment(-5, 0, 0, 0, 10, 0)).toBe(5)
  })

  it('handles a degenerate zero-length segment as a point', () => {
    expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBe(5)
  })
})
