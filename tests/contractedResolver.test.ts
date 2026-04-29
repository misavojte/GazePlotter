import { describe, it, expect } from 'vitest'
import { resolveContractedInstance } from '../src/lib/plots/shared/contractedResolver'
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

const aoiVectorContract: PlotMetricContract = {
  outputShape: 'aoi-vector',
  windowing: 'forbidden',
}

// Contract for windowed aoi-vector consumers (e.g. aoi-stream). The
// `outputShape` names the leaf's shape (`aoi-vector`); a `windowing: 'required'`
// flag wraps it into `aoi-vector-timeseries` at query time.
const windowedAoiVectorContract: PlotMetricContract = {
  outputShape: 'aoi-vector',
  windowing: 'required',
}

describe('resolveContractedInstance', () => {
  it('returns ok for an instance that matches the contract', () => {
    const result = resolveContractedInstance(instances, 'absoluteTime', aoiVectorContract)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.instance.id).toBe('absoluteTime')
      expect(result.instance.baseId).toBe('absoluteTime')
    }
  })

  it('returns reason="missing" when id is null', () => {
    const result = resolveContractedInstance(instances, null, aoiVectorContract)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing')
  })

  it('returns reason="missing" when id is not in the library', () => {
    const result = resolveContractedInstance(instances, 'no-such-instance', aoiVectorContract)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing')
  })

  it('returns reason="missing" when instances is undefined', () => {
    const result = resolveContractedInstance(undefined, 'absoluteTime', aoiVectorContract)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing')
  })

  it('returns reason="shape-mismatch" when a non-windowed instance is offered for a windowing-required contract', () => {
    const result = resolveContractedInstance(instances, 'absoluteTime', windowedAoiVectorContract)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('shape-mismatch')
  })

  it('returns reason="shape-mismatch" when a windowed instance is offered for a forbidden-windowing contract', () => {
    // 'absoluteTime-aoi-windowed-500' is a windowed instance; the bar contract
    // (aoi-vector + windowing: 'forbidden') must reject it.
    const result = resolveContractedInstance(instances, 'absoluteTime-aoi-windowed-500', aoiVectorContract)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('shape-mismatch')
  })

  it('returns ok for a windowed instance under a windowing-required contract', () => {
    findStarter('absoluteTime-aoi-windowed-500') // sanity check existence
    const result = resolveContractedInstance(instances, 'absoluteTime-aoi-windowed-500', windowedAoiVectorContract)
    expect(result.ok).toBe(true)
  })
})
