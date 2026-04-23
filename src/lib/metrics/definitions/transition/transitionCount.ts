import { defineMetric } from '../../core/defineMetric'
import { enumParam } from '../../core/params'
import { initTransitionAcc, processFixation } from '../../core/transitionScan'

const params = [
  enumParam('mode', 'Count mode', 'fixation' as 'fixation' | 'visit', [
    { value: 'fixation', label: 'Fixation pairs' },
    { value: 'visit',    label: 'Visit changes' },
  ]),
] as const

/**
 * ## Transition count
 *
 * Number of times gaze transitioned from AOI `i` (row) to AOI `j` (column).
 *
 * - **Shape:** `aoi-pair-matrix`
 * - **Unit:** `count`
 * - **Category:** `transition`
 * - **Windowing:** supported (but pair-matrix output — windowed use only
 *   meaningful with a `matrix-cell` / `matrix-aggregate` inner leaf).
 *
 * ### Parameters
 * - `mode` (enum, default `'fixation'`): `'fixation'` counts every
 *   consecutive fixation pair; `'visit'` counts only transitions between
 *   distinct AOI visits (collapsing consecutive same-AOI fixations).
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'transitionCount-fix', baseId: 'transitionCount',
 *     params: { mode: 'fixation' },
 *     projection: { kind: 'identity-aoi-pair-matrix' },
 *     label: 'Transition count' },
 *   { engine, stimulusId, participantId },
 * )
 * // → { shape: 'aoi-pair-matrix', matrix: [flat n*n], size: n, ... }
 * ```
 *
 * ### Invariants
 * - `additive: true` — allows `matrix-aggregate` with `sum` / `mean`
 *   reducers (counts are scientifically summable across cells).
 * - Group aggregation is `sum` because counts grow with participant
 *   count; use `transitionRelativeFrequency` for cross-participant means.
 */
defineMetric({
  id: 'transitionCount',
  label: 'Transition count',
  description:
    'Number of times gaze transitioned from one AOI (row) to another (column). ' +
    'In fixation mode every consecutive pair counts; in visit mode only actual AOI changes count.',
  unit: 'count',
  category: 'transition',
  rawShape: 'aoi-pair-matrix',
  windowUnit: 'ms',
  groupAggregation: 'sum',
  additive: true,
  defaultLabel: (p) =>
    p.mode === 'visit'
      ? 'Transition count (visit changes)'
      : 'Transition count (fixation pairs)',
  searchTags: ['transition', 'matrix', 'pair', 'aoi', 'count', 'sequence', 'markov'],
  params,
  init: ({ slots }) => initTransitionAcc(slots.totalSlots),
  onFixation: (acc, fix, { params: p }) => {
    processFixation(acc, fix, p.mode, (cellIdx) => { acc.matrix[cellIdx]++ })
  },
  finalize: (acc) => Array.from(acc.matrix),
})
