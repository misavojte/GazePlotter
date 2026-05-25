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
  boolParam('collapsed', 'Collapse consecutive AOIs', false),
] as const

/**
 * ## Scanpath similarity (participant × participant)
 *
 * Pairwise normalized similarity between participants' AOI-letter scanpaths.
 *
 * - **Shape:** `participant-pair-matrix`
 * - **Unit:** `0–1` (1 = identical, 0 = completely different)
 * - **Category:** `scanpath`
 * - **Windowing:** sliding-window projection is not supported (`supportsWindowing: false`).
 *   Time-of-interest cropping via `scope.timeStart/timeEnd` IS supported — a
 *   fixation is encoded when its onset falls in `[timeStart, timeEnd)`.
 *
 * ### Parameters
 * - `method` (enum, default `'levenshtein'`): comparison kernel.
 *     - `levenshtein`: edit-distance based, normalized by max length.
 *     - `needlemanWunsch`: global alignment score with match=+1 / mismatch=-1
 *       / gap=-1, normalized to [0, 1].
 * - `collapsed` (bool, default `false`): if true, fold consecutive identical
 *   AOIs in each scanpath before comparison ("AABBC" → "ABC"). Useful when
 *   dwell duration shouldn't dominate the structural comparison.
 *
 * ### Computation
 * - Each participant's scanpath is encoded as an AOI-letter string ('#' for
 *   fixations outside any visible AOI).
 * - For every pair (i, j), the chosen kernel is applied; the matrix is
 *   symmetric with diagonal = 1.
 * - Values are rounded to three decimals to keep matrix labels stable.
 *
 * ### Invariants
 * - `supportsGroupAggregation: false` — the matrix IS the group-level
 *   quantity; reducing across participants would collapse its defining axis.
 * - Per-participant projections (typicality, mean-row → scalar) are reserved
 *   for a follow-up that adds a group-cached / per-participant-extract path.
 */
defineMetric({
  id: 'participantPairSimilarity',
  label: 'Scanpath similarity',
  description:
    "Per participant pair: normalized similarity between participants' AOI-letter scanpaths. " +
    'Symmetric, with diagonal = 1. Levenshtein uses edit distance; Needleman-Wunsch uses global alignment.',
  unit: '0–1',
  category: 'scanpath',
  rawShape: 'participant-pair-matrix',
  windowUnit: 'ms',
  supportsWindowing: false,
  supportsGroupAggregation: false,
  searchTags: ['scanpath', 'similarity', 'levenshtein', 'needleman-wunsch', 'pairwise', 'comparison'],
  params,
  defaultLabel: (p) => {
    const methodLabel = p.method === 'needlemanWunsch' ? 'Needleman-Wunsch' : 'Levenshtein'
    return p.collapsed
      ? `Scanpath similarity (${methodLabel}, collapsed)`
      : `Scanpath similarity (${methodLabel})`
  },
  scanGroup: (scope, { method, collapsed }) => {
    const meta = scope.engine.metadata
    const aois = meta?.aois.data[scope.stimulusId] ? getAois(scope.engine, scope.stimulusId) : []
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
