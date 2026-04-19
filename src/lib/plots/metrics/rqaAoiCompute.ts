import { computeRQA } from '$lib/plots/recurrence/core/rqa'
import type { ParticipantBarMetrics } from '$lib/plots/bar/types'
import type { MetricInstance } from './types'

export function computeRqaAoiScalar(
  instance: MetricInstance,
  metrics: ParticipantBarMetrics
): number {
  const seq = metrics.fixationAoiSequence
  const N = seq.length
  if (N < 2) return Number.NaN

  const matrix = new Uint8Array(N * N)
  for (let i = 0; i < N - 1; i++) {
    for (let j = i + 1; j < N; j++) {
      if (seq[i] === seq[j]) matrix[i * N + j] = 1
    }
  }

  // REC does not depend on L; DET uses l_min; LAM uses v_min.
  // computeRQA uses a single L for both diagonal and H/V line detection,
  // so each metric is extracted from a separate call with its own threshold.
  const L = Number(
    instance.baseId === 'rqaDet'
      ? (instance.params.l_min ?? 2)
      : instance.baseId === 'rqaLam'
        ? (instance.params.v_min ?? 2)
        : 2
  )

  const rqa = computeRQA(matrix, N, L)

  if (rqa.R === 0) {
    // REC=0% is correct (no recurrences). DET/LAM are undefined (not "zero structure").
    if (instance.baseId === 'rqaDet' || instance.baseId === 'rqaLam') return Number.NaN
    return 0
  }

  switch (instance.baseId) {
    case 'rqaRec': return rqa.REC
    case 'rqaDet': return rqa.DET
    case 'rqaLam': return rqa.LAM
    default: return Number.NaN
  }
}
