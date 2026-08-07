import { getAois } from '$lib/data/engine'
import { defineMetric } from '../../core/defineMetric'
import { boolParam } from '../../core/params'
import { collectAllScanpaths } from '../../core/scanpathEncoding'
import { computeSimilarityMatrix } from '../../core/scanpathSimilarity'

const params = [
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
  id: 'scanpathLevenshteinSimilarity',
  label: 'Levenshtein similarity',
  description:
    "Per participant pair: normalized Levenshtein similarity between participants' AOI-letter scanpaths. " +
    'Symmetric, with diagonal = 1. Uses minimum edit distance (insertions, deletions, substitutions).',
  unit: '',
  category: 'scanpath',
  rawShape: 'participant-pair-matrix',
  windowUnit: 'ms',
  supportsWindowing: false,
  measurementClass: 'relational',
  searchTags: ['scanpath', 'similarity', 'levenshtein', 'pairwise', 'comparison', 'edit distance'],
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
      matrix: computeSimilarityMatrix(entries.map(e => e.scanpath), 'levenshtein'),
      participantIds: entries.map(e => e.participantId),
    }
  },
})
