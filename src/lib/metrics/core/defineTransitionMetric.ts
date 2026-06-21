/**
 * Factory for transition-based aoi-pair-matrix metrics.
 *
 * The five transition recipes (`transitionCount`, `transitionDwellSum`,
 * `transitionDwellMean`, `transitionProbability`, `transitionRelativeFrequency`)
 * share the same skeleton: the universal `mode` enum param, an `aoi-pair-matrix`
 * raw shape with `ms` window unit and `transition` category, an `init` that
 * builds a `TransitionAcc` (sometimes with an aux matrix), and an `onFixation`
 * that delegates to `processFixation`. Only the per-transition contribution
 * and the `finalize` reduction differ across recipes.
 *
 * This factory captures the skeleton; per-recipe call sites supply only the
 * unique pieces. New transition metrics drop in as a ~30-line spec.
 */
import type { ParamDef } from './params'
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
  /** Cross-participant reduction; the existing recipes use `sum` or `mean`. */
  groupAggregation: 'mean' | 'median' | 'sum'
  /** Defaults to `false`. Counts and summed durations opt in. */
  additive?: boolean
  searchTags: readonly string[]
  /**
   * Extra params *after* the built-in `mode`. Use for recipe-specific knobs
   * like `transitionProbability`'s `step` integer.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraParams?: readonly ParamDef<any>[]
  /**
   * Set `true` when the recipe needs a companion `auxMatrix` on the
   * accumulator (e.g. `transitionDwellMean` keeps both count and dwell sum).
   */
  withAux?: boolean
  /**
   * Per-transition contribution. Called from inside `processFixation`'s
   * `onTransition` for every detected transition. `prevDuration` is the
   * preceding fixation/visit duration in ms.
   */
  onTransition: (acc: TransitionAcc, cellIdx: number, prevDuration: number) => void
  /**
   * Reduce the accumulator to the flat row-major output array (size² entries).
   */
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
    groupAggregation: spec.groupAggregation,
    additive: spec.additive,
    searchTags: spec.searchTags,
    params,
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
