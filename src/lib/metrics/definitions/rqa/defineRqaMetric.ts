import { defineMetric } from '../../core/defineMetric'
import { boolParam, integerParam, type ParamDef } from '../../core/params'
import { rqaScalar, type RqaResult } from '../../core/rqa'

/**
 * Shared scaffold for the AOI-sequence RQA scalars (REC/DET/LAM). All three
 * accumulate the same `{ seq: number[] }` (single-AOI fixations only, optional
 * off-AOI sentinel) and differ only in the measure, the min-line param, and
 * the no-recurrence value.
 *
 * The only FIXATION-windowed metrics: `windowSize`/`stepSize` are fixation
 * counts, not ms, and the inner leaf must be `identity-scalar`.
 */
export function defineRqaMetric(spec: {
  id: string
  label: string
  description: string
  searchTags: string[]
  /** Which {@link RqaResult} scalar this metric reports. */
  measure: (r: RqaResult) => number
  /** Min-line-length param id (DET `l_min`, LAM `v_min`). Omitted for REC —
   *  pair counting needs no line length; 2 is passed through untouched. */
  minLineParam?: 'l_min' | 'v_min'
  /** Reported when `R === 0`. REC pins 0 (zero recurrences IS a 0% rate);
   *  line-based measures keep rqaScalar's NaN default. */
  onNoRecurrence?: number
}): void {
  const { measure, minLineParam, onNoRecurrence } = spec
  const params: ParamDef<any>[] = [
    ...(minLineParam
      ? [integerParam(minLineParam, 'Min line', 2, { min: 2, max: 20 })]
      : []),
    boolParam('include_no_aoi', 'Include off-AOI fixations', false),
  ]
  const minLine = (p: Record<string, unknown>): number =>
    minLineParam ? (p[minLineParam] as number) : 2

  defineMetric({
    id: spec.id,
    label: spec.label,
    description: spec.description,
    unit: '%',
    category: 'rqa-aoi',
    rawShape: 'scalar',
    windowUnit: 'fixations',
    measurementClass: 'intensive',
    searchTags: spec.searchTags,
    params,
    accumulation: 'stateful',
    init: (): { seq: number[] } => ({ seq: [] }),
    onFixation: (acc, { slots }, { slots: info, params: p }) => {
      if (slots.length === 1) acc.seq.push(slots[0])
      else if (p.include_no_aoi && slots.length === 0) acc.seq.push(info.noAoiSlot)
    },
    finalize: (acc, _slots, ctx) =>
      [rqaScalar(acc.seq, minLine(ctx.params), measure, onNoRecurrence)],
    windowedFinalize: (acc, from, to, ctx) =>
      rqaScalar(acc.seq.slice(from, to), minLine(ctx.params), measure, onNoRecurrence),
  })
}
