import { getAois } from '$lib/data/engine'
import { defineMetric } from '../../core/defineMetric'
import { boolParam, enumParam } from '../../core/params'
import { collectAllScanpaths } from '../../core/scanpathEncoding'
import {
  computeSimilarityMatrix,
  type SimilarityMethod,
} from '../../core/scanpathSimilarity'

const params = [
  enumParam('method', 'Similarity method', 'levenshtein' as SimilarityMethod, [
    { value: 'levenshtein',     label: 'Levenshtein' },
    { value: 'needlemanWunsch', label: 'Needleman-Wunsch' },
  ]),
  boolParam('collapsed', 'Collapse consecutive AOIs', false, {
    toLabel: v => (v ? 'collapsed' : null),
  }),
] as const

/**
 * Values in [0, 1], rounded to three decimals so matrix labels stay stable.
 * Sliding windows are unsupported, but time-of-interest cropping via
 * `scope.timeStart/timeEnd` works — a fixation is encoded when its onset falls
 * in `[timeStart, timeEnd)`. `collapsed` folds "AABBC" → "ABC", for when dwell
 * duration should not dominate the structural comparison.
 */
defineMetric({
  id: 'participantPairSimilarity',
  label: 'Scanpath similarity',
  description:
    "Per participant pair: normalized similarity between participants' AOI-letter scanpaths. " +
    'Symmetric, with diagonal = 1. Levenshtein uses edit distance; Needleman-Wunsch uses global alignment.',
  // Dimensionless: the range rides on the colorbar ticks, and `/` is reserved
  // for real IUPAC units.
  unit: '',
  category: 'scanpath',
  rawShape: 'participant-pair-matrix',
  windowUnit: 'ms',
  supportsWindowing: false,
  measurementClass: 'relational',
  searchTags: ['scanpath', 'similarity', 'levenshtein', 'needleman-wunsch', 'pairwise', 'comparison'],
  params,
  scanGroup: (scope, { method, collapsed }) => {
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
      matrix: computeSimilarityMatrix(entries.map(e => e.scanpath), method),
      participantIds: entries.map(e => e.participantId),
    }
  },
})
