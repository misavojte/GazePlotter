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
 * Sum of pre-transition fixation/visit durations per AOI pair [from, to].
 * Registered but not pre-seeded; power users add it manually when raw totals
 * (rather than means) are useful. `transitionDwellMean` is the preferred default.
 */
defineMetric({
  id: 'transitionDwellSum',
  label: 'Transition dwell sum',
  description:
    'Sum of pre-transition fixation durations per AOI pair. In fixation mode, ' +
    'the duration of the single preceding fixation; in visit mode, the total ' +
    'duration of the preceding visit (consecutive same-AOI fixations merged).',
  unit: 'ms',
  category: 'transition',
  outputShape: 'aoi-pair-matrix',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  groupAggregation: 'sum',
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
