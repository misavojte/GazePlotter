/**
 * Factory for transition-based aoi-pair-matrix metrics. The five recipes share
 * everything but their per-transition contribution and their `finalize`, so
 * only those are supplied per call site.
 */
import type { ParamDef } from './params'
import type { MeasurementClass, GroupReduction } from './measurement'
import { defineMetric } from './defineMetric'
import { enumParam } from './params'
import {
  initTransitionAcc,
  processFixation,
  type TransitionAcc,
} from './transitionScan'

/** Built-in `mode` param shared by every transition metric. */
const modeParam = enumParam(
  'mode',
  'Count mode',
  'fixation' as 'fixation' | 'visit',
  [
    { value: 'fixation', label: 'Fixation pairs' },
    { value: 'visit', label: 'Visit changes' },
  ],
)

export interface DefineTransitionMetricSpec<P> {
  id: string
  label: string
  description: string
  /** Per-recipe unit (`count`, `ms`, `%`, …). */
  unit: string
  /** `extensive` for counts/summed dwell, `intensive` for
   *  averages/probabilities/shares. */
  measurementClass: MeasurementClass
  /** `'sum'` for the `extensive` recipes. */
  defaultReduction?: GroupReduction
  searchTags: readonly string[]
  /** Recipe-specific knobs after the built-in `mode`, like
   *  `transitionProbability`'s `step`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraParams?: readonly ParamDef<any>[]
  /** For a recipe needing a companion matrix — `transitionDwellMean` keeps
   *  both count and dwell sum. */
  withAux?: boolean
  /** Called from `processFixation` per detected transition. `prevDuration` is
   *  the preceding fixation/visit duration in ms. */
  onTransition: (acc: TransitionAcc, cellIdx: number, prevDuration: number) => void
  /** Reduce to the flat row-major output array (size² entries). */
  finalize: (acc: TransitionAcc, params: P) => number[]
}

export function defineTransitionMetric<P>(
  spec: DefineTransitionMetricSpec<P>,
): void {
  const params = [modeParam, ...(spec.extraParams ?? [])] as const
  defineMetric({
    id: spec.id,
    label: spec.label,
    description: spec.description,
    unit: spec.unit,
    category: 'transition',
    rawShape: 'aoi-pair-matrix',
    windowUnit: 'ms',
    // A transition needs BOTH its fixations, so a window emits it only when it sees
    // the pair: at most once per window of a partition, and NOT AT ALL when the two
    // straddle a boundary. Counts therefore undercount slightly over a partition;
    // 'own' would not help, since ownership is defined per fixation, not per pair.
    windowMembership: 'all',
    measurementClass: spec.measurementClass,
    defaultReduction: spec.defaultReduction,
    searchTags: spec.searchTags,
    params,
    // Transition accumulators carry the previous fixation's slots — stateful.
    accumulation: 'stateful',
    init: ({ slots }) => initTransitionAcc(slots.totalSlots, spec.withAux ?? false),
    onFixation: (acc, fix, { params: p }) => {
      processFixation(
        acc,
        fix,
        (p as { mode: 'fixation' | 'visit' }).mode,
        (cellIdx, prevDuration) => spec.onTransition(acc, cellIdx, prevDuration),
      )
    },
    finalize: (acc, _slots, { params: p }) => spec.finalize(acc, p as unknown as P),
  })
}
