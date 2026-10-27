import { describe, it, expect } from 'vitest'
import { makeTwoAoiEngine } from './helpers/testEngine'
import { getAoiComparisonData } from '../src/lib/plots/aoi-comparison/core/transformer'

const ABSOLUTE_TIME_INSTANCE_ID = 'absoluteTime'

// The transformer tolerates PARTIAL settings (stale keys from old workspaces
// resolve to defaults); Partial<> keeps key typos compile-checked while
// allowing the omissions these cases are about.
type DataSettings = Parameters<typeof getAoiComparisonData>[1]
const partialSettings = (s: Partial<DataSettings>) => s as DataSettings

describe('Bar Plot Transformer (Integration)', () => {
  const stimulusId = 0
  // The full settings of the non-partial cases; each passes only what it is about.
  const run = (engine: ReturnType<typeof makeTwoAoiEngine>, over: Partial<DataSettings> = {}) =>
    getAoiComparisonData(engine, {
      stimulusId,
      metricInstanceIds: [ABSOLUTE_TIME_INSTANCE_ID],
      orderBy: 'aoi',
      orderDirection: 'asc',
      scaleRange: [0, 0],
      statisticalOverlay: 'none',
      ...over,
    })

  it('transforms raw segments into labeled and sorted bar data', () => {
    const engine = makeTwoAoiEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
          [300, 350, 0],
        ],
      ],
    ])

    const result = run(engine)

    expect(result.data).toHaveLength(3)
    expect(result.data[0].label).toBe('AOI A')
    expect(result.data[0].value).toBe(100)
    expect(result.data[1].label).toBe('AOI B')
    expect(result.data[1].value).toBe(200)
    expect(result.data[2].label).toBe('Outside')
    expect(result.data[2].value).toBe(50)
  })

  it('applies sorting by value descending', () => {
    const engine = makeTwoAoiEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
        ],
      ],
    ])

    const result = run(engine, { orderBy: 'value', orderDirection: 'desc' })

    expect(result.data[0].label).toBe('AOI B')
    expect(result.data[1].label).toBe('AOI A')
  })

  it('generates a nice timeline based on data max value', () => {
    const engine = makeTwoAoiEngine([[[[0, 450, 0, 0]]]])

    const result = getAoiComparisonData(
      engine,
      partialSettings({
        stimulusId,
        metricInstanceIds: [ABSOLUTE_TIME_INSTANCE_ID],
      })
    )

    expect(result.timeline.maxValue).toBeGreaterThanOrEqual(450)
  })

  it('handles custom scale range', () => {
    const engine = makeTwoAoiEngine([[[[0, 100, 0, 0]]]])

    const result = getAoiComparisonData(
      engine,
      partialSettings({
        stimulusId,
        metricInstanceIds: [ABSOLUTE_TIME_INSTANCE_ID],
        scaleRange: [0, 1000],
      })
    )

    expect(result.timeline.maxValue).toBe(1000)
  })

  it('handles lack of participants', () => {
    const engine = makeTwoAoiEngine([[]])
    engine.metadata!.participants.data = []
    engine.metadata!.participants.orderVector = []

    const result = getAoiComparisonData(
      engine,
      partialSettings({
        stimulusId,
      })
    )

    expect(result.data).toEqual([])
  })

  it('flags noMetric when metricInstanceIds[0] references a deleted instance', () => {
    const engine = makeTwoAoiEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
        ],
      ],
    ])

    const result = run(engine, { metricInstanceIds: ['nonexistent-id'] }) // does not exist in the library

    expect(result.noMetric).toBe(true)
    expect(result.data).toEqual([])
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

    expect(result.data).toHaveLength(2)
    expect(result.data[0].label).toBe('AOI A')
    expect(result.data[0].value).toBe(100)
    expect(result.data[1].label).toBe('AOI B')
    expect(result.data[1].value).toBe(200)
    expect(result.data.find(d => d.label === 'Outside')).toBeUndefined()
  })

  it('excludes Outside (No AOI) from dataMax calculation when hideNoAoi is true', () => {
    const engine = makeTwoAoiEngine([
      [
        [
          [0, 100, 0, 0], // AOI A (100 ms)
          [100, 200, 0, 1], // AOI B (100 ms)
          [200, 700, 0], // Outside (500 ms)
        ],
      ],
    ])

    const result = run(engine, { hideNoAoi: true })

    // Max AOI value is 100 (Outside has 500 but should be excluded from scale dataMax calculation)
    expect(result.dataMax).toBe(100)
  })
})
