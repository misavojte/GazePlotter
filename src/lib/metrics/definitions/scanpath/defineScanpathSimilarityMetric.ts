import { getAois } from '$lib/data/engine'
import { defineMetric } from '../../core/defineMetric'
import { boolParam } from '../../core/params'
import { collectAllScanpaths } from '../../core/scanpathEncoding'
import { computeSimilarityMatrix, type SimilarityMethod } from '../../core/scanpathSimilarity'

const params = [
  boolParam('collapsed', 'Collapse consecutive AOIs', false, {
    toLabel: v => (v ? 'collapsed' : null),
  }),
] as const

/**
 * Shared scaffold for the pairwise scanpath similarities, which differ only in
 * the string-comparison `method`.
 *
 * Values in [0, 1], rounded to three decimals so matrix labels stay stable.
 * Sliding windows are unsupported, but time-of-interest cropping via
 * `scope.timeStart/timeEnd` works: a fixation is encoded when its onset falls
 * in `[timeStart, timeEnd)`. `collapsed` folds "AABBC" → "ABC", for when dwell
 * duration should not dominate the structural comparison.
 */
export function defineScanpathSimilarityMetric(spec: {
  id: string
  label: string
  description: string
  searchTags: string[]
  method: SimilarityMethod
}): void {
  defineMetric({
    id: spec.id,
    label: spec.label,
    description: spec.description,
    unit: '',
    category: 'scanpath',
    rawShape: 'participant-pair-matrix',
    windowUnit: 'ms',
    supportsWindowing: false,
    measurementClass: 'relational',
    searchTags: spec.searchTags,
    params,
    scanGroup: (scope, { collapsed }) => {
      const meta = scope.engine.metadata
      const aois = meta?.aois.data[scope.stimulusId]
        ? getAois(scope.engine, scope.stimulusId, scope.aoiSelectionId)
        : []
      const entries = collectAllScanpaths(
        scope.engine,
        scope.stimulusId,
        scope.participantIds,
        aois,
        collapsed,
        scope.timeStart ?? 0,
        scope.timeEnd ?? 0,
      )
      return {
        matrix: computeSimilarityMatrix(entries.map(e => e.scanpath), spec.method),
        participantIds: entries.map(e => e.participantId),
      }
    },
  })
}
