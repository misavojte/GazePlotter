import { defineMetric } from '../core/defineMetric'
import { enumParam } from '../core/params'
import { initTransitionAcc, processFixation } from '../core/transitionScan'

const params = [
  enumParam('mode', 'Count mode', 'fixation' as 'fixation' | 'visit', [
    { value: 'fixation', label: 'Fixation pairs' },
    { value: 'visit',    label: 'Visit changes' },
  ]),
] as const

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
