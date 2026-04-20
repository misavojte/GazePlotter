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
 * Per-cell mean pre-transition dwell time — the average time the participant
 * spent at AOI_i before transitioning to AOI_j.
 *
 * At the participant level this is `dwellSum / count` per cell; cells with
 * no observed transitions emit NaN (so the cross-participant mean reduces
 * across only participants who actually made that transition). The group
 * aggregation is mean-of-per-participant-means — each participant is one
 * observational unit, consistent with standard eye-tracking reporting.
 */
defineMetric({
  id: 'transitionDwellMean',
  label: 'Mean transition dwell time',
  description:
    'Average time spent at the "from" AOI before each transition to the "to" AOI. ' +
    'In fixation mode, the duration of the single preceding fixation; in visit mode, ' +
    'the total duration of the preceding visit.',
  unit: 'ms',
  category: 'transition',
  rawShape: 'aoi-pair-matrix',
  windowUnit: 'ms',
  groupAggregation: 'mean',
  defaultLabel: (p) =>
    p.mode === 'visit'
      ? 'Mean transition dwell time (visit changes)'
      : 'Mean transition dwell time (fixation pairs)',
  searchTags: ['transition', 'dwell', 'mean', 'average', 'duration', 'pair', 'aoi', 'time'],
  params,
  starterInstances: [
    { params: { mode: 'fixation' } },
    { params: { mode: 'visit' } },
  ],
  init: ({ slots }) => initTransitionAcc(slots.totalSlots, /* withAux */ true),
  onFixation: (acc, fix, { params: p }) => {
    processFixation(acc, fix, p.mode, (cellIdx, prevDuration) => {
      acc.matrix[cellIdx]++                     // count
      acc.auxMatrix![cellIdx] += prevDuration   // dwell sum
    })
  },
  finalize: (acc) => {
    const out = new Array<number>(acc.matrix.length)
    for (let i = 0; i < acc.matrix.length; i++) {
      out[i] = acc.matrix[i] > 0 ? acc.auxMatrix![i] / acc.matrix[i] : Number.NaN
    }
    return out
  },
})
