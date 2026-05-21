import { describe, it, expect } from 'vitest'
import { resolveMetric } from '../src/lib/plots/shared/metricResolver'
import {
  createDefaultMetricInstances,
  type MetricInstance,
  type PlotMetricContract,
} from '../src/lib/metrics'

const instances = createDefaultMetricInstances()

function findStarter(id: string): MetricInstance {
  const inst = instances.find(i => i.id === id)
  if (!inst) throw new Error(`Starter instance not found: ${id}`)
  return inst
}

const aoiVectorContract = {
  outputShape: 'aoi-vector',
  windowing: 'forbidden',
} as const satisfies PlotMetricContract

// Contract for windowed aoi-vector consumers (e.g. aoi-stream). The
// `outputShape` names the leaf's shape (`aoi-vector`); a `windowing: 'required'`
// flag wraps it into `aoi-vector-timeseries` at query time.
const windowedAoiVectorContract = {
  outputShape: 'aoi-vector',
  windowing: 'required',
} as const satisfies PlotMetricContract

describe('resolveMetric', () => {
  it('returns ok for an instance that matches the contract', () => {
    const result = resolveMetric({
      instances,
      id: 'absoluteTime',
      contract: aoiVectorContract,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.instance.id).toBe('absoluteTime')
      expect(result.instance.baseId).toBe('absoluteTime')
    }
  })

  it('rejects when id is null', () => {
    const result = resolveMetric({ instances, id: null, contract: aoiVectorContract })
    expect(result.ok).toBe(false)
  })

  it('rejects when id is not in the library', () => {
    const result = resolveMetric({
      instances,
      id: 'no-such-instance',
      contract: aoiVectorContract,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects when instances is undefined', () => {
    const result = resolveMetric({
      instances: undefined,
      id: 'absoluteTime',
      contract: aoiVectorContract,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a non-windowed instance under a windowing-required contract', () => {
    const result = resolveMetric({
      instances,
      id: 'absoluteTime',
      contract: windowedAoiVectorContract,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a windowed instance under a forbidden-windowing contract', () => {
    // 'absoluteTime-aoi-windowed-500' is a windowed instance; the bar contract
    // (aoi-vector + windowing: 'forbidden') must reject it.
    const result = resolveMetric({
      instances,
      id: 'absoluteTime-aoi-windowed-500',
      contract: aoiVectorContract,
    })
    expect(result.ok).toBe(false)
  })

  it('accepts a windowed instance under a windowing-required contract and materialises `window`', () => {
    findStarter('absoluteTime-aoi-windowed-500') // sanity check existence
    const result = resolveMetric({
      instances,
      id: 'absoluteTime-aoi-windowed-500',
      contract: windowedAoiVectorContract,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(typeof result.window.windowSize).toBe('number')
      expect(typeof result.window.stepSize).toBe('number')
      expect(result.window.windowSize).toBeGreaterThan(0)
    }
  })
})
