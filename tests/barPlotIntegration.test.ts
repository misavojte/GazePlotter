import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBarPlotData } from '../src/lib/plots/bar/core/transformer'
import {
  getAois,
  getParticipantsIds,
  engine,
  getSegments,
} from '$lib/data/engine'

vi.mock('$lib/data/engine', () => ({
  getAois: vi.fn(),
  getParticipantsIds: vi.fn(),
  getSegments: vi.fn(),
  engine: {
    metadata: {
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    },
  },
}))

describe('Bar Plot Transformer (Integration)', () => {
  const stimulusId = 0
  const groupId = 0

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAois).mockReturnValue([
      { id: 0, displayedName: 'AOI A', color: 'red' },
      { id: 1, displayedName: 'AOI B', color: 'blue' },
    ] as any)
    vi.mocked(getParticipantsIds).mockReturnValue([101])
  })

  it('transforms raw segments into labeled and sorted bar data', () => {
    // 101: A(100ms) -> B(200ms) -> Outside(50ms)
    vi.mocked(getSegments).mockReturnValue([
      { start: 0, end: 100, aoi: [{ id: 0 }] },
      { start: 100, end: 300, aoi: [{ id: 1 }] },
      { start: 300, end: 350, aoi: [] },
    ] as any)

    const result = getBarPlotData({
      stimulusId,
      groupId,
      aggregationMethod: 'absoluteTime',
      orderBy: 'aoi',
      orderDirection: 'asc',
      scaleRange: [0, 0],
    } as any)

    expect(result.data).toHaveLength(3) // AOI A, AOI B, Outside

    // Check values
    expect(result.data[0].label).toBe('AOI A')
    expect(result.data[0].value).toBe(100)

    expect(result.data[1].label).toBe('AOI B')
    expect(result.data[1].value).toBe(200)

    expect(result.data[2].label).toBe('Outside')
    expect(result.data[2].value).toBe(50)
  })

  it('applies sorting by value descending', () => {
    vi.mocked(getSegments).mockReturnValue([
      { start: 0, end: 100, aoi: [{ id: 0 }] },
      { start: 100, end: 300, aoi: [{ id: 1 }] },
    ] as any)

    const result = getBarPlotData({
      stimulusId,
      groupId,
      aggregationMethod: 'absoluteTime',
      orderBy: 'value',
      orderDirection: 'desc',
      scaleRange: [0, 0],
    } as any)

    // AOI B (200) should be first, then AOI A (100)
    expect(result.data[0].label).toBe('AOI B')
    expect(result.data[1].label).toBe('AOI A')
  })

  it('generates a nice timeline based on data max value', () => {
    vi.mocked(getSegments).mockReturnValue([
      { start: 0, end: 450, aoi: [{ id: 0 }] },
    ] as any)

    const result = getBarPlotData({
      stimulusId,
      groupId,
      aggregationMethod: 'absoluteTime',
    } as any)

    // Max value is 450. Timeline should probably end at a "nice" number >= 450 (e.g. 500)
    expect(result.timeline.maxValue).toBeGreaterThanOrEqual(450)
  })

  it('handles custom scale range', () => {
    vi.mocked(getSegments).mockReturnValue([
      { start: 0, end: 100, aoi: [{ id: 0 }] },
    ] as any)

    const result = getBarPlotData({
      stimulusId,
      groupId,
      aggregationMethod: 'absoluteTime',
      scaleRange: [0, 1000],
    } as any)

    expect(result.timeline.maxValue).toBe(1000)
  })

  it('handles lack of participants', () => {
    vi.mocked(getParticipantsIds).mockReturnValue([])

    const result = getBarPlotData({ stimulusId, groupId } as any)

    expect(result.data).toEqual([])
  })
})
