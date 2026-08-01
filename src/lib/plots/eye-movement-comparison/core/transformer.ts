import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  getAllCategories,
  applyCategorySelection,
  getParticipant,
  getParticipantsIds,
  getParticipantEndTime,
} from '$lib/data/engine'
import { groupByDisplayedName } from '$lib/data/engine/utils/grouping'
import { asScalar, createAdaptiveTimeline } from '$lib/plots/shared'
import {
  applySorting,
  computeSummaryStatistics,
  valueAxisTimeline,
} from '$lib/plots/bar/core/transformer'
import type { BarPlotDataItem, BarPlotResult } from '$lib/plots/bar/types'
import { formatDecimal } from '$lib/shared/utils/mathUtils'
import { query, type MetricInstance, type Scope } from '$lib/metrics'
import { METRIC_SOURCE } from './const'
import type {
  EyeMovementComparisonSettings,
  EyeMovementMetric,
} from '../types'

/**
 * One bar per eye-movement type present in the dataset, computed through the
 * pinned eye-movement metric recipes (never a parallel computation): each
 * participant contributes one dot per type, and the bar is the mean of those
 * per-participant values — the exact data shape `BarPlotFigure` renders for
 * the AOI Comparison, so the whole figure (beeswarm, overlays, ordering,
 * scale) is inherited.
 *
 * Type rows: every type present — Fixation included — folds by displayed name
 * (same displayed name = same logical entity; Fixation's reserved name keeps
 * it a singleton) and narrows by the per-plot eye-movement-type SELECTION,
 * the same `applyCategorySelection` gate the scarf uses. 'None' narrows every
 * type away (an empty plot).
 */
export function getEyeMovementComparisonData(
  engine: DataEngine,
  settings: Pick<
    EyeMovementComparisonSettings,
    | 'stimulusId'
    | 'groupId'
    | 'categorySelectionId'
    | 'metric'
    | 'orderBy'
    | 'orderDirection'
    | 'scaleRange'
    | 'timelineStart'
    | 'timelineEnd'
    | 'statisticalOverlay'
  >
): BarPlotResult {
  const meta = engine.metadata
  if (!meta) throw new Error('No metadata found')

  const participantIds = getParticipantsIds(
    engine,
    settings.groupId,
    settings.stimulusId
  )
  if (participantIds.length === 0) {
    return { data: [], timeline: createAdaptiveTimeline(0, 100, 6), dataMax: 0 }
  }

  const { kept } = applyCategorySelection(
    engine,
    groupByDisplayedName(getAllCategories(engine)),
    settings.categorySelectionId
  )
  const types = kept.map(g => ({
    displayedName: g.displayedName,
    color: g.color,
  }))

  const timeStart = settings.timelineStart ?? 0
  const timeEnd = settings.timelineEnd ?? 0
  const overlay = settings.statisticalOverlay ?? 'none'
  const participantNames = participantIds.map(
    id => getParticipant(engine, id).displayedName
  )
  // timeShare's denominator is type-invariant: the bounded range when one is
  // set, otherwise each participant's recording length. The scan cannot see
  // it (that is why the metric family has no share recipe); the plot can.
  const shareDenominators =
    settings.metric === 'timeShare'
      ? participantIds.map(pid =>
          timeEnd > timeStart
            ? timeEnd - timeStart
            : getParticipantEndTime(engine, settings.stimulusId, pid)
        )
      : null

  const data: BarPlotDataItem[] = types.map(type => {
    const instance = instanceForMetric(settings.metric, type.displayedName)
    const values: number[] = []
    const names: string[] = []
    for (let p = 0; p < participantIds.length; p++) {
      const scope: Scope = {
        engine,
        stimulusId: settings.stimulusId,
        participantId: participantIds[p],
        timeStart,
        timeEnd,
      }
      let v = asScalar(query(instance, scope))?.value ?? Number.NaN
      if (shareDenominators) {
        const denominator = shareDenominators[p]
        v = denominator > 0 ? (v / denominator) * 100 : Number.NaN
      }
      // NaN drops the participant from this type's distribution (e.g. mean
      // duration with no such segments); a real 0 (count) stays a dot.
      if (Number.isFinite(v)) {
        values.push(v)
        names.push(participantNames[p])
      }
    }
    const stats = computeSummaryStatistics(values)
    return {
      value: formatDecimal(stats.mean),
      label: type.displayedName,
      color: type.color,
      stats,
      individualValues: values,
      individualParticipantNames: names,
    }
  })

  const sortedData = applySorting(
    data,
    settings.orderBy || 'type',
    settings.orderDirection || 'asc'
  )

  // Axis maximum from the raw dots (and whiskers under a boxplot overlay) —
  // the same rule the AOI Comparison applies.
  let dataMax = 0
  for (const item of data) {
    for (const v of item.individualValues ?? []) {
      if (v > dataMax) dataMax = v
    }
    if (overlay === 'boxplot' && item.stats && item.stats.whiskerHigh > dataMax) {
      dataMax = item.stats.whiskerHigh
    }
  }

  return { data: sortedData, timeline: valueAxisTimeline(dataMax, settings.scaleRange), dataMax }
}

/**
 * The metric instance computing `metric` for one displayed type name (per the
 * `METRIC_SOURCE` table). Plain literals, not library instances: the
 * library's one-type-per-instance design stays intact, and the result cache
 * keys on (baseId, params), so repeated derives hit the same entries as any
 * other consumer of these recipes.
 */
function instanceForMetric(
  metric: EyeMovementMetric,
  displayedName: string
): MetricInstance {
  const source = METRIC_SOURCE[metric]
  return {
    id: `eyeMovementComparison:${metric}:${displayedName}`,
    baseId: source.baseId,
    params: { ...source.params, eyeMovementType: displayedName },
    label: '',
    projection: { kind: 'identity-scalar' },
  }
}
