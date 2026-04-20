import { defineMetric } from '../core/defineMetric'
import { enumParam } from '../core/params'
import { initTransitionAcc, processFixation } from '../core/transitionScan'

const params = [
  enumParam('mode', 'Count mode', 'fixation' as 'fixation' | 'visit', [
    { value: 'fixation', label: 'Fixation pairs' },
    { value: 'visit',    label: 'Visit changes' },
  ]),
] as const

/**
 * Per-cell share of the participant's total transitions, as a percentage.
 * Cross-participant aggregation is mean-of-per-participant-percentages —
 * each participant contributes equally regardless of their absolute count.
 * Participants with zero total transitions contribute NaN (excluded from the
 * group reduce).
 */
defineMetric({
  id: 'transitionRelativeFrequency',
  label: 'Transition relative frequency',
  description:
    'Per-cell fraction of the participant\'s total transitions, as a percentage. ' +
    'Answers: "what share of this participant\'s transitions were AOI_i → AOI_j?"',
  unit: '%',
  category: 'transition',
  outputShape: 'aoi-pair-matrix',
  windowUnit: 'ms',
  computationModes: ['global'],
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
