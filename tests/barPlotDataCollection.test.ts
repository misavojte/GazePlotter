import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectParticipantBarMetrics } from '../src/lib/plots/bar/core/collector'
import { getSegments } from '$lib/data/engine'

vi.mock('$lib/data/engine', () => ({
  getSegments: vi.fn(),
}))

describe('Bar Plot Data Collection', () => {
  const stimulusId = 1
  const participantIds = [101]
  const aois = [
    { id: 1, displayedName: 'AOI 1', color: 'red' },
    { id: 2, displayedName: 'AOI 2', color: 'blue' },
  ] as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should collect basic dwell time and fixation counts', () => {
    // Segment 1: AOI 1 (100ms)
    // Segment 2: AOI 1 + 2 (200ms)
    // Segment 3: No AOI (50ms)
    // Segment 4: AOI 2 (150ms)
    const mockedSegments = [
      { start: 0, end: 100, aoi: [{ id: 1 }] },
      { start: 100, end: 300, aoi: [{ id: 1 }, { id: 2 }] },
      { start: 300, end: 350, aoi: [] },
      { start: 350, end: 500, aoi: [{ id: 2 }] },
    ]
    vi.mocked(getSegments).mockReturnValue(mockedSegments as any)

    const result = collectParticipantBarMetrics(
      stimulusId,
      participantIds,
      aois
    )

    expect(result).toHaveLength(1)
    const p1 = result[0]

    // Dwell Time:
    // AOI 1: 100 + 200 = 300
    // AOI 2: 200 + 150 = 350
    // No-AOI: 50
    // AnyFixation: 500 (total duration of all fixation segments)
    expect(p1.dwellTime[0]).toBe(300)
    expect(p1.dwellTime[1]).toBe(350)
    expect(p1.dwellTime[2]).toBe(50)
    expect(p1.dwellTime[3]).toBe(500)

    // Fixation Count:
    // AOI 1: 2 segments
    // AOI 2: 2 segments
    // No-AOI: 1 segment
    // AnyFixation: 4 segments
    expect(p1.fixationCount[0]).toBe(2)
    expect(p1.fixationCount[1]).toBe(2)
    expect(p1.fixationCount[2]).toBe(1)
    expect(p1.fixationCount[3]).toBe(4)

    // Entry Count:
    // AOI 1: Entered once at start, stayed through seg 2.
    // AOI 2: Entered once at seg 2, left at seg 3, entered again at seg 4. -> 2 entries.
    // No-AOI: Entered once at seg 3.
    // AnyFixation: Entered at 1, 2 (change in set), 3 (change in set), 4 (change in set). -> 4 entries.
    expect(p1.entryCount[0]).toBe(1)
    expect(p1.entryCount[1]).toBe(2)
    expect(p1.entryCount[2]).toBe(1)
    expect(p1.entryCount[3]).toBe(4)
  })

  it('should treat consecutive segments in same AOI as one entry', () => {
    const mockedSegments = [
      { start: 0, end: 100, aoi: [{ id: 1 }] },
      { start: 100, end: 200, aoi: [{ id: 1 }] },
      { start: 200, end: 300, aoi: [{ id: 1 }] },
    ]
    vi.mocked(getSegments).mockReturnValue(mockedSegments as any)

    const result = collectParticipantBarMetrics(
      stimulusId,
      participantIds,
      aois
    )
    const p1 = result[0]

    expect(p1.entryCount[0]).toBe(1)
    expect(p1.dwellTime[0]).toBe(300)
    expect(p1.dwellDurations[0]).toEqual([300])
  })

  it('should handle AOI overlap correctly (multiple AOIs in one segment)', () => {
    const mockedSegments = [{ start: 0, end: 100, aoi: [{ id: 1 }, { id: 2 }] }]
    vi.mocked(getSegments).mockReturnValue(mockedSegments as any)

    const result = collectParticipantBarMetrics(
      stimulusId,
      participantIds,
      aois
    )
    const p1 = result[0]

    expect(p1.dwellTime[0]).toBe(100)
    expect(p1.dwellTime[1]).toBe(100)
    expect(p1.entryCount[0]).toBe(1)
    expect(p1.entryCount[1]).toBe(1)
  })

  it('should correctly capture TTFF from the very first segment', () => {
    const mockedSegments = [{ start: 50, end: 100, aoi: [{ id: 1 }] }]
    vi.mocked(getSegments).mockReturnValue(mockedSegments as any)

    const result = collectParticipantBarMetrics(
      stimulusId,
      participantIds,
      aois
    )
    const p1 = result[0]

    expect(p1.ttff[0]).toBe(50)
    expect(p1.ttff[3]).toBe(50) // AnyFixation
  })

  it('should handle gaps (No AOI) in timeToFirstFixation', () => {
    const mockedSegments = [
      { start: 0, end: 50, aoi: [] },
      { start: 50, end: 100, aoi: [{ id: 1 }] },
    ]
    vi.mocked(getSegments).mockReturnValue(mockedSegments as any)

    const result = collectParticipantBarMetrics(
      stimulusId,
      participantIds,
      aois
    )
    const p1 = result[0]

    expect(p1.ttff[2]).toBe(0) // No AOI starts at 0
    expect(p1.ttff[0]).toBe(50) // AOI 1 starts at 50
    expect(p1.ttff[3]).toBe(0) // AnyFixation starts at 0
  })

  it('should handle participants with no data', () => {
    vi.mocked(getSegments).mockReturnValue([])

    const result = collectParticipantBarMetrics(
      stimulusId,
      participantIds,
      aois
    )

    expect(result).toHaveLength(1)
    expect(result[0].dwellTime.every(v => v === 0)).toBe(true)
    expect(result[0].ttff.every(v => v === -1)).toBe(true)
    expect(result[0].fixationCount.every(v => v === 0)).toBe(true)
  })

  it('should correctly aggregate multiple participants', () => {
    const participantIds = [101, 102]
    vi.mocked(getSegments).mockImplementation((s, pid) => {
      if (pid === 101) return [{ start: 0, end: 100, aoi: [{ id: 1 }] }] as any
      if (pid === 102) return [{ start: 0, end: 200, aoi: [{ id: 2 }] }] as any
      return []
    })

    const result = collectParticipantBarMetrics(
      stimulusId,
      participantIds,
      aois
    )
    expect(result).toHaveLength(2)

    // P1
    expect(result[0].dwellTime[0]).toBe(100)
    expect(result[0].dwellTime[1]).toBe(0)

    // P2
    expect(result[1].dwellTime[0]).toBe(0)
    expect(result[1].dwellTime[1]).toBe(200)
  })
})
