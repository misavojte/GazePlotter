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
 * ## Transition relative frequency
 *
 * Per-cell share of the participant's total transitions, as a percentage.
 *
 * - **Shape:** `aoi-pair-matrix`
 * - **Unit:** `%`
 * - **Category:** `transition`
 * - **Windowing:** supported (matrix-cell / matrix-aggregate inner leaf only).
 *
 * ### Parameters
 * - `mode` (enum, default `'fixation'`): `'fixation'` counts consecutive
 *   fixation pairs; `'visit'` counts distinct-AOI transitions only.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'custom-rf', baseId: 'transitionRelativeFrequency',
 *     params: { mode: 'fixation' },
 *     projection: { kind: 'identity-aoi-pair-matrix' },
 *     label: 'Transition relative frequency' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - Matrix sums to 100% by construction (per participant).
 * - Participants with zero total transitions emit all-NaN — they drop from
 *   cross-participant reduces.
 * - Cross-participant `groupAggregation` is `mean`: each participant
 *   contributes their own percentage, equal-weighted.
 * - Not `additive` — summing percentages across cells is meaningless, so
 *   the validator restricts `matrix-aggregate` to `max | min`.
 */
defineMetric({
  id: 'transitionRelativeFrequency',
  label: 'Transition relative frequency',
  description:
    "Per AOI pair (row → column): share of the participant's total transitions that went row → column, " +
    'expressed as a percentage. Matrix sums to 100% per participant.',
  unit: '%',
  category: 'transition',
  rawShape: 'aoi-pair-matrix',
  windowUnit: 'ms',
  groupAggregation: 'mean',
  defaultLabel: (p) =>
    p.mode === 'visit'
      ? 'Transition relative frequency (visit)'
      : 'Transition relative frequency (fixation)',
  searchTags: ['transition', 'frequency', 'relative', 'percent', 'proportion', 'aoi', 'pair'],
  params,
  init: ({ slots }) => initTransitionAcc(slots.totalSlots),
  onFixation: (acc, fix, { params: p }) => {
    processFixation(acc, fix, p.mode, (cellIdx) => { acc.matrix[cellIdx]++ })
  },
  finalize: (acc) => {
    let total = 0
    for (let i = 0; i < acc.matrix.length; i++) total += acc.matrix[i]
    if (total === 0) return new Array<number>(acc.matrix.length).fill(Number.NaN)
    const out = new Array<number>(acc.matrix.length)
    for (let i = 0; i < acc.matrix.length; i++) out[i] = (acc.matrix[i] / total) * 100
    return out
  },
})
