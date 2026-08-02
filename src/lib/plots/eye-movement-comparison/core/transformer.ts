import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  applyCategorySelection,
  getParticipant,
  getParticipantsIds,
} from '$lib/data/engine'
import { resolveMetric } from '$lib/plots/shared'
import {
  applySorting,
  computeSummaryStatistics,
  valueAxisTimeline,
} from '$lib/plots/bar/core/transformer'
import type { BarPlotDataItem, BarPlotResult } from '$lib/plots/bar/types'
import { formatDecimal } from '$lib/shared/utils/mathUtils'
import {
  categoryGroups,
  getMetric,
  queryPooledIndividuals,
  type PlotMetricContract,
} from '$lib/metrics'
import type { EyeMovementComparisonSettings } from '../types'

/**
 * Category-vector instances only: the metric IS the per-type vector, and this
 * plot draws the whole vector as bars (identity projection). Single types are
 * a `pick-category` projection concern on scalar plots, never a parameter.
 */
export const EYE_MOVEMENT_COMPARISON_CONTRACT = {
  outputShape: 'category-vector',
  windowing: 'forbidden',
  crossParticipant: 'distribution',
} as const satisfies PlotMetricContract

/**
 * One bar per eye-movement type, straight off the library instance's
 * category-vector result (never a parallel computation): each participant is
 * queried ONCE for the whole vector, contributes one dot per type, and the
 * bar is the mean of those per-participant values — the exact data shape
 * `BarPlotFigure` renders for the AOI Comparison, so the whole figure
 * (beeswarm, overlays, ordering, scale) is inherited.
 *
 * Type rows: the canonical `categoryGroups` axis (the same order contract the
 * recipes' vectors are indexed by), narrowed by the per-plot
 * eye-movement-type SELECTION — the same `applyCategorySelection` gate the
 * scarf uses. 'None' narrows every type away (an empty plot).
 */
export function getEyeMovementComparisonData(
  engine: DataEngine,
  settings: Pick<
    EyeMovementComparisonSettings,
    | 'stimulusId'
    | 'groupId'
    | 'categorySelectionId'
    | 'metricInstanceIds'
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

  const resolved = resolveMetric({
    instances: meta.metricInstances,
    id: settings.metricInstanceIds?.[0] ?? null,
    contract: EYE_MOVEMENT_COMPARISON_CONTRACT,
  })
  if (!resolved.ok) {
    return { data: [], timeline: valueAxisTimeline(0, undefined), dataMax: 0, noMetric: true }
  }
  const { instance } = resolved
  // A `proportion`-class metric renders as a plain proportional bar, not a
  // beeswarm — the same rule the AOI Comparison applies to `fixated`. Read
  // off the declared class rather than a recipe list: no category-vector
  // metric is proportion today (the time share is intensive, like
  // relativeTime), so this is false for every admissible instance.
  const isProportion =
    getMetric(instance.baseId)?.meta.measurementClass === 'proportion'

  const participantIds = getParticipantsIds(
    engine,
    settings.groupId,
    settings.stimulusId
  )
  if (participantIds.length === 0) {
    return { data: [], timeline: valueAxisTimeline(0, undefined), dataMax: 0 }
  }

  // The canonical type axis — the recipes' vectors are indexed by it — with
  // each group's slot retained, then narrowed by the SELECTION.
  const axis = categoryGroups(engine).map((g, slot) => ({ ...g, slot }))
  const { kept } = applyCategorySelection(engine, axis, settings.categorySelectionId)

  const timeStart = settings.timelineStart ?? 0
  const timeEnd = settings.timelineEnd ?? 0
  const overlay = settings.statisticalOverlay ?? 'none'

  // The shared beeswarm-pooling rule (see queryPooledIndividuals) — the SAME
  // call the AOI Comparison makes, over the kept TYPE slots instead of AOI
  // slots: movementDuration's per-segment sample becomes one dot per segment,
  // the totals contribute one dot per participant from the cached vector.
  const pooled = queryPooledIndividuals(
    instance,
    participantIds.map(participantId => ({
      engine, stimulusId: settings.stimulusId, participantId, timeStart, timeEnd,
    })),
    participantIds.map(pid => getParticipant(engine, pid).displayedName),
    kept.map(type => type.slot)
  )

  const data: BarPlotDataItem[] = kept.map((type, i) => {
    const values = pooled.values[i]
    const stats = computeSummaryStatistics(values)
    return {
      value: formatDecimal(stats.mean),
      label: type.displayedName,
      color: type.color,
      stats,
      individualValues: values,
      individualParticipantNames: pooled.names[i],
    }
  })

  const sortedData = applySorting(
    data,
    settings.orderBy || 'type',
    settings.orderDirection || 'asc'
  )

  // Axis maximum — the same rules the AOI Comparison applies: proportion bars
  // are data-driven off the bar values; distributions scan the raw dots (and
  // whiskers under a boxplot overlay).
  let dataMax = 0
  if (isProportion) {
    for (const item of data) {
      if (item.value > dataMax) dataMax = item.value
    }
  } else {
    for (const item of data) {
      for (const v of item.individualValues ?? []) {
        if (v > dataMax) dataMax = v
      }
      if (overlay === 'boxplot' && item.stats && item.stats.whiskerHigh > dataMax) {
        dataMax = item.stats.whiskerHigh
      }
    }
  }

  return {
    data: sortedData,
    timeline: valueAxisTimeline(dataMax, settings.scaleRange),
    dataMax,
    proportion: isProportion,
  }
}
