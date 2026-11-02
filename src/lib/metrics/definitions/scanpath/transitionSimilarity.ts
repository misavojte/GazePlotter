import { defineMetric, getRecipe } from '../../core/defineMetric'
import { enumParam } from '../../core/params'
import { runSingleWindow } from '../../core/runtime'
import type { MetricInstance } from '../../instances'

const params = [
  enumParam('mode', 'Count mode', 'visit' as 'fixation' | 'visit', [
    { value: 'visit', label: 'Visit changes' },
    { value: 'fixation', label: 'Fixation pairs' },
  ]),
] as const

/** Cosine of two non-negative count vectors; NaN when either has no counts. */
function cosine(a: readonly number[], b: readonly number[]): number {
  let ab = 0
  let aa = 0
  let bb = 0
  for (let c = 0; c < a.length; c++) {
    ab += a[c] * b[c]
    aa += a[c] * a[c]
    bb += b[c] * b[c]
  }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : NaN
}

/**
 * Cosine similarity of two participants' AOI transition counts, as in
 * GazeAlytics' "Cosine of Transitions". The counts are the `transitionCount`
 * recipe's own matrices (outside-AOI row and column included), so this metric
 * shares its scan, its cache and its count modes.
 */
defineMetric({
  id: 'transitionSimilarity',
  label: 'Transition similarity',
  description:
    "Per participant pair: cosine similarity of the two participants' AOI transition counts (from → to), " +
    'from 0 (no transition in common) to 1 (the same mix of transitions). Only the mix counts, not how many transitions there are or when. ' +
    'Visit changes counts moves between AOIs; Fixation pairs also counts staying in an AOI.',
  unit: '',
  category: 'scanpath',
  rawShape: 'participant-pair-matrix',
  windowUnit: 'ms',
  supportsWindowing: false,
  measurementClass: 'relational',
  searchTags: ['scanpath', 'similarity', 'transition', 'cosine', 'pairwise', 'comparison', 'markov'],
  params,
  scanGroup: (scope, { mode }) => {
    const participantIds = [...scope.participantIds]
    const size = participantIds.length
    const counts = getRecipe('transitionCount')!
    const instance: MetricInstance = {
      id: 'transitionSimilarity:counts',
      baseId: 'transitionCount',
      params: { mode },
      label: '',
      projection: { kind: 'identity-aoi-pair-matrix' },
    }
    const vectors = participantIds.map(participantId =>
      runSingleWindow(
        counts,
        instance,
        { ...scope, participantId },
        scope.timeStart ?? 0,
        scope.timeEnd ?? 0
      )
    )
    const matrix = new Array<number>(size * size).fill(NaN)
    for (let i = 0; i < size; i++) {
      for (let j = i; j < size; j++) {
        const rounded = Math.round(cosine(vectors[i], vectors[j]) * 1000) / 1000
        matrix[i * size + j] = rounded
        matrix[j * size + i] = rounded
      }
    }
    return { matrix, participantIds }
  },
})
