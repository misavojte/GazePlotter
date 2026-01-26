import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectTransitionMetrics } from '../src/lib/plots/transition-matrix/core/collector'
import { getSegments } from '$lib/data/engine'

vi.mock('$lib/data/engine', () => ({
  getSegments: vi.fn(),
}))

describe('collectTransitionMetrics', () => {
  const mockAois = [
    { id: 1, displayedName: 'AOI 1' },
    { id: 2, displayedName: 'AOI 2' },
  ] as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should collect simple fixation transitions correctly', () => {
    const segments = [
      { aoi: [{ id: 1 }], start: 0, end: 100 },
      { aoi: [{ id: 2 }], start: 100, end: 250 },
      { aoi: [], start: 250, end: 300 }, // No AOI
    ]

    vi.mocked(getSegments).mockReturnValue(segments as any)

    const result = collectTransitionMetrics(1, [1], mockAois, 'fixation')
    const size = mockAois.length + 1

    // Transition 1 -> 2 (0 -> 1)
    expect(result.sumMatrix[0 * size + 1]).toBe(1)
    expect(result.dwellTimeMatrix[0 * size + 1]).toBe(100) // from AOI 1 duration

    // Transition 2 -> Outside (1 -> 2)
    expect(result.sumMatrix[1 * size + 2]).toBe(1)
    expect(result.dwellTimeMatrix[1 * size + 2]).toBe(150) // from AOI 2 duration

    expect(result.totalTransitions).toBe(2)
  })

  it('should handle visit mode correctly by merging consecutive AOIs', () => {
    const segments = [
      { aoi: [{ id: 1 }], start: 0, end: 100 },
      { aoi: [{ id: 1 }], start: 100, end: 200 },
      { aoi: [{ id: 2 }], start: 200, end: 350 },
    ]

    vi.mocked(getSegments).mockReturnValue(segments as any)

    const result = collectTransitionMetrics(1, [1], mockAois, 'visit')
    const size = mockAois.length + 1

    // In visit mode, the two AOI 1 segments are merged into one visit of 200ms
    // Then there is a transition to AOI 2
    expect(result.sumMatrix[0 * size + 1]).toBe(1)
    expect(result.dwellTimeMatrix[0 * size + 1]).toBe(200)
    expect(result.totalTransitions).toBe(1)
  })
})
