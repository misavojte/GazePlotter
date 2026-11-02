import { describe, it, expect } from 'vitest'
import { makeTwoAoiEngine } from './helpers/testEngine'
import { getAoiStreamPlotData } from '../src/lib/plots/aoi-stream/core/transformer'

const WINDOWED_TIME_INSTANCE_ID = 'absoluteTime-aoi-windowed-500'

// The transformer tolerates PARTIAL settings (stale keys from old workspaces
// resolve to defaults); Partial<> keeps key typos compile-checked while
// allowing the omissions these cases are about.
type StreamSettings = Parameters<typeof getAoiStreamPlotData>[1]
const partialSettings = (s: Partial<StreamSettings>) => s as StreamSettings

describe('AOI Stream Plot Transformer (Integration)', () => {
  const stimulusId = 0
  // The settings every case shares; each passes only what it is about.
  const run = (engine: ReturnType<typeof makeTwoAoiEngine>, over: Partial<StreamSettings> = {}) =>
    getAoiStreamPlotData(
      engine,
      partialSettings({ stimulusId, metricInstanceIds: [WINDOWED_TIME_INSTANCE_ID], ...over })
    )

  it('transforms raw segments into time series binned occupancy', () => {
    const engine = makeTwoAoiEngine([
      [
        [
          [0, 100, 0, 0], // AOI A
          [100, 300, 0, 1], // AOI B
          [300, 350, 0], // Outside (No AOI)
        ],
      ],
    ])

    const result = run(engine)

    // Outside (No AOI) should be present since hideNoAoi is undefined (defaults to false)
    expect(result.series).toHaveLength(3)
    expect(result.series[0].label).toBe('AOI A')
    expect(result.series[1].label).toBe('AOI B')
    expect(result.series[2].label).toBe('Outside')
  })

  it('exposes the metric native unit so the bin tooltip can show real values (not a fabricated %)', () => {
    const engine = makeTwoAoiEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
        ],
      ],
    ])

    const result = run(engine)

    // Windowed absolute dwell is in ms; the tooltip shows native values in this
    // unit, matching the axis — never `(value / participants) * 100 + "%"`.
    expect(result.unit).toBe('ms')
    expect(result.yAxisLabel).toContain('ms')
  })

  it('correctly filters out Outside (No AOI) when hideNoAoi is true', () => {
    const engine = makeTwoAoiEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
          [300, 350, 0],
        ],
      ],
    ])

    const result = run(engine, { hideNoAoi: true })

    // Only AOI A and AOI B should be in the series list
    expect(result.series).toHaveLength(2)
    expect(result.series[0].label).toBe('AOI A')
    expect(result.series[1].label).toBe('AOI B')
    expect(result.series.find(s => s.label === 'Outside')).toBeUndefined()
  })

  it('excludes Outside (No AOI) from maxValue and maxTotal calculations when hideNoAoi is true', () => {
    const engine = makeTwoAoiEngine([
      [
        [
          [0, 50, 0, 0], // AOI A (50 ms)
          [50, 100, 0, 1], // AOI B (50 ms)
          [100, 500, 0], // Outside (400 ms)
        ],
      ],
    ])

    const result = run(engine, { hideNoAoi: true })

    // Check that maximums are calculated using only AOI A and AOI B values (50 ms)
    expect(result.maxValue).toBeLessThanOrEqual(50)
    expect(result.maxTotal).toBeLessThanOrEqual(100) // AOI A + AOI B in the 0-500 ms window
  })
})
