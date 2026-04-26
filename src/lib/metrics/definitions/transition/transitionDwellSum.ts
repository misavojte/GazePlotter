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
 * ## Transition dwell sum
 *
 * Sum of pre-transition fixation/visit durations per AOI pair `[from, to]`.
 *
 * - **Shape:** `aoi-pair-matrix`
 * - **Unit:** `ms`
 * - **Category:** `transition`
 * - **Windowing:** supported (matrix-cell / matrix-aggregate inner leaf).
 *
 * ### Parameters
 * - `mode` (enum, default `'fixation'`): in fixation mode, the summed
 *   quantity is the duration of each preceding single fixation; in visit
 *   mode, the total duration of the preceding visit (consecutive same-AOI
 *   fixations merged).
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'custom-ds', baseId: 'transitionDwellSum',
 *     params: { mode: 'fixation' },
 *     projection: { kind: 'identity-aoi-pair-matrix' },
 *     label: 'Transition dwell sum' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - `additive: true` — ms totals are summable across cells, so
 *   `matrix-aggregate` with `sum` / `mean` reducers is allowed.
 * - Group aggregation is `sum` — totals scale with participant count.
 *   Use `transitionDwellMean` for cross-participant mean dwell.
 * - Not pre-seeded as a starter; power users add it manually when raw
 *   totals (rather than means) are useful.
 */
defineMetric({
  id: 'transitionDwellSum',
  label: 'Transition dwell sum',
  description:
    'Per AOI pair (row → column): sum of pre-transition dwell times before each row → column transition. ' +
    'In fixation mode that\'s the duration of the single preceding fixation; in visit mode, the duration ' +
    'of the preceding visit (consecutive same-AOI fixations merged).',
  unit: 'ms',
  category: 'transition',
  rawShape: 'aoi-pair-matrix',
  windowUnit: 'ms',
  groupAggregation: 'sum',
  additive: true,
  defaultLabel: (p) =>
    p.mode === 'visit'
      ? 'Transition dwell sum (visit)'
      : 'Transition dwell sum (fixation)',
  searchTags: ['transition', 'dwell', 'duration', 'pair', 'aoi', 'time', 'sum'],
  params,
  init: ({ slots }) => initTransitionAcc(slots.totalSlots),
  onFixation: (acc, fix, { params: p }) => {
    processFixation(acc, fix, p.mode, (cellIdx, prevDuration) => {
      acc.matrix[cellIdx] += prevDuration
    })
  },
  finalize: (acc) => Array.from(acc.matrix),
})
