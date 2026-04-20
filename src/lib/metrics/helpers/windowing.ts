import type { WindowingConfig } from '../types'

type Reduction = WindowingConfig['reduction']

function reduce(values: number[], method: Reduction): number {
  const valid = values.filter(v => Number.isFinite(v))
  if (valid.length === 0) return Number.NaN
  switch (method) {
    case 'mean':  return valid.reduce((a, b) => a + b, 0) / valid.length
    case 'max':   return Math.max(...valid)
    case 'min':   return Math.min(...valid)
    case 'final': return valid[valid.length - 1]
  }
}

export function applyTimeWindowing(
  mode: 'epoch' | 'sliding',
  windowSize: number,
  stepSize: number,
  totalStart: number,
  totalEnd: number,
  reduction: Reduction,
  computeWindow: (tStart: number, tEnd: number) => number
): number {
  if (totalEnd <= totalStart) return Number.NaN
  const scalars: number[] = []
  if (mode === 'epoch') {
    for (let wStart = totalStart; wStart + windowSize <= totalEnd; wStart += windowSize) {
      scalars.push(computeWindow(wStart, wStart + windowSize))
    }
  } else {
    for (let wStart = totalStart; wStart + windowSize <= totalEnd; wStart += stepSize) {
      scalars.push(computeWindow(wStart, wStart + windowSize))
    }
  }
  return reduce(scalars, reduction)
}

export function applyGroupedTimeWindowing(
  mode: 'epoch' | 'sliding',
  windowSize: number,
  stepSize: number,
  totalStart: number,
  totalEnd: number,
  reduction: Reduction,
  computeWindow: (tStart: number, tEnd: number) => number[],
): number[] {
  if (totalEnd <= totalStart) return []
  const windowResults: number[][] = []
  if (mode === 'epoch') {
    for (let wStart = totalStart; wStart + windowSize <= totalEnd; wStart += windowSize) {
      windowResults.push(computeWindow(wStart, wStart + windowSize))
    }
  } else {
    for (let wStart = totalStart; wStart + windowSize <= totalEnd; wStart += stepSize) {
      windowResults.push(computeWindow(wStart, wStart + windowSize))
    }
  }
  if (windowResults.length === 0) return []
  const slotCount = windowResults[0].length
  const result = new Array<number>(slotCount)
  for (let s = 0; s < slotCount; s++) {
    result[s] = reduce(windowResults.map(w => w[s] ?? Number.NaN), reduction)
  }
  return result
}

export function applyFixationWindowing(
  mode: 'epoch' | 'sliding',
  windowSize: number,
  stepSize: number,
  reduction: Reduction,
  computeWindow: (subSeq: number[]) => number,
  fullSeq: number[]
): number {
  const N = fullSeq.length
  if (N < windowSize) return Number.NaN
  const scalars: number[] = []
  if (mode === 'epoch') {
    for (let start = 0; start + windowSize <= N; start += windowSize) {
      scalars.push(computeWindow(fullSeq.slice(start, start + windowSize)))
    }
  } else {
    for (let start = 0; start + windowSize <= N; start += stepSize) {
      scalars.push(computeWindow(fullSeq.slice(start, start + windowSize)))
    }
  }
  return reduce(scalars, reduction)
}
