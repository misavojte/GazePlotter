import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectParticipantBarMetrics } from '../src/lib/plots/bar/core/collector'
import * as dataStore from '../src/lib/gaze-data/front-process/stores/dataStore'

vi.mock('../src/lib/gaze-data/front-process/stores/dataStore', () => ({
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
    // Mock segments for participant 101
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
    ;(dataStore.getSegments as any).mockReturnValue(mockedSegments)

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
    // AnyFixation: 500 (total duration)
    expect(p1.dwellTime[0]).toBe(300)
    expect(p1.dwellTime[1]).toBe(350)
    expect(p1.dwellTime[2]).toBe(50) // No AOI index
    expect(p1.dwellTime[3]).toBe(500) // Any Fixation index

    // Fixation Count:
    // AOI 1: 2
    // AOI 2: 2
    // No-AOI: 1
    // AnyFixation: 4
    expect(p1.fixationCount[0]).toBe(2)
    expect(p1.fixationCount[1]).toBe(2)
    expect(p1.fixationCount[2]).toBe(1)
    expect(p1.fixationCount[3]).toBe(4)

    // TTFF:
    // AOI 1: 0
    // AOI 2: 100
    // No-AOI: 300
    // AnyFixation: 0
    expect(p1.ttff[0]).toBe(0)
    expect(p1.ttff[1]).toBe(100)
    expect(p1.ttff[2]).toBe(300)
    expect(p1.ttff[3]).toBe(0)

    // Entry Count / Dwells:
    // AOI 1: 1 dwell [300] (consecutive)
    // AOI 2: 2 dwells [200, 150] (split by No-AOI)
    // No-AOI: 1 dwell [50]
    // AnyFixation: 4 dwells (every transition is a dwell in my impl for AnyFixation)
    // Wait, my impl says: AnyFixation entryCount++ on every "transition to different set".
    // Seg 1 -> 2: {1} -> {1,2} (TRANSITION)
    // Seg 2 -> 3: {1,2} -> {} (TRANSITION)
    // Seg 3 -> 4: {} -> {2} (TRANSITION)
    // Total AnyFixation entries: 4 (starting + 3 transitions)
    expect(p1.entryCount[0]).toBe(1)
    expect(p1.entryCount[1]).toBe(2)
    expect(p1.entryCount[2]).toBe(1)
    expect(p1.entryCount[3]).toBe(4)

    expect(p1.dwellDurations[0]).toEqual([300])
    expect(p1.dwellDurations[1]).toEqual([200, 150])
    expect(p1.dwellDurations[2]).toEqual([50])
  })

  it('should handle participants with no segments', () => {
    ;(dataStore.getSegments as any).mockReturnValue([])

    const result = collectParticipantBarMetrics(
      stimulusId,
      participantIds,
      aois
    )

    expect(result).toHaveLength(1)
    expect(result[0].dwellTime).toEqual([0, 0, 0, 0])
    expect(result[0].ttff).toEqual([-1, -1, -1, -1])
  })
})
