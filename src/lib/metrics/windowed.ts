import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ExtendedInterpretedDataType, MetricInstance, WindowingConfig } from '$lib/data/types'
import { collectMetricData } from './collector'
import type { MetricData } from './types'
import { computeRqaAoiScalar } from './rqaAoiCompute'
import { getMetricDef } from './registry'

const MIN_FIXATIONS_RQA = 5

function applyReduction(values: number[], method: WindowingConfig['reduction']): number {
  const valid = values.filter(v => Number.isFinite(v))
  if (valid.length === 0) return Number.NaN
  switch (method) {
    case 'mean':  return valid.reduce((a, b) => a + b, 0) / valid.length
    case 'max':   return Math.max(...valid)
    case 'min':   return Math.min(...valid)
    case 'final': return valid[valid.length - 1]
  }
}

function epochRqa(
  instance: MetricInstance,
  seq: number[],
  windowSize: number,
  reduction: WindowingConfig['reduction']
): number {
  const scalars: number[] = []
  for (let start = 0; start + windowSize <= seq.length; start += windowSize) {
    const sub = seq.slice(start, start + windowSize)
    if (sub.length >= MIN_FIXATIONS_RQA)
      scalars.push(computeRqaAoiScalar(instance, { fixationAoiSequence: sub }))
  }
  return applyReduction(scalars, reduction)
}

function slidingRqa(
  instance: MetricInstance,
  seq: number[],
  windowSize: number,
  reduction: WindowingConfig['reduction']
): number {
  const N = seq.length
  if (N < windowSize) return Number.NaN
  const scalars: number[] = []
  for (let start = 0; start + windowSize <= N; start++) {
    const sub = seq.slice(start, start + windowSize)
    scalars.push(computeRqaAoiScalar(instance, { fixationAoiSequence: sub }))
  }
  return applyReduction(scalars, reduction)
}

function epochNonRqa(
  instance: MetricInstance,
  aoiIndex: number,
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  aois: ExtendedInterpretedDataType[],
  windowSizeMs: number,
  totalStart: number,
  totalEnd: number,
  reduction: WindowingConfig['reduction']
): number {
  if (totalEnd <= totalStart) return Number.NaN
  const def = getMetricDef(instance.baseId)
  if (!def) return Number.NaN
  const scalars: number[] = []
  for (let wStart = totalStart; wStart + windowSizeMs <= totalEnd; wStart += windowSizeMs) {
    const wMetrics = collectMetricData(
      engine, stimulusId, [participantId], aois, wStart, wStart + windowSizeMs
    )
    if (wMetrics[0])
      scalars.push(def.compute(wMetrics[0], aoiIndex, instance))
  }
  return applyReduction(scalars, reduction)
}

export function computeWindowedScalar(
  instance: MetricInstance,
  participantMetrics: MetricData,
  aoiIndex: number,
  totalStart: number,
  totalEnd: number,
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  aois: ExtendedInterpretedDataType[]
): number {
  const { mode, windowSize, reduction } = instance.windowing!
  const def = getMetricDef(instance.baseId)
  const isRqa = def?.windowUnit === 'fixations'

  if (isRqa) {
    const seq = participantMetrics.fixationAoiSequence
    return mode === 'sliding'
      ? slidingRqa(instance, seq, windowSize, reduction)
      : epochRqa(instance, seq, windowSize, reduction)
  }

  return epochNonRqa(
    instance, aoiIndex, engine, stimulusId, participantId, aois,
    windowSize, totalStart, totalEnd, reduction
  )
}
