import { getAois } from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotMetricContract } from '$lib/metrics'
import {
  collectDistribution,
  distributionParticipants,
  type DistributionAxis,
  type DistributionResult,
  type DistributionSlot,
} from '$lib/plots/shared/distribution'
import type { AoiComparisonSettings } from '../types'

/**
 * AOI-vector instances only: the metric IS the per-AOI vector, and this plot
 * draws the whole vector as one distribution per AOI (identity projection).
 * Single AOIs are a `pick-aoi` projection concern on scalar plots.
 */
export const AOI_COMPARISON_CONTRACT = {
  outputShape: 'aoi-vector',
  windowing: 'forbidden',
  crossParticipant: 'distribution',
} as const satisfies PlotMetricContract

type AoiComparisonDataSettings = Pick<
  AoiComparisonSettings,
  | 'stimulusId'
  | 'groupId'
  | 'metricInstanceIds'
  | 'orderBy'
  | 'orderDirection'
  | 'scaleRange'
  | 'timelineStart'
  | 'timelineEnd'
  | 'statisticalOverlay'
  | 'hideNoAoi'
  | 'aoiSelectionId'
>

/**
 * One distribution per AOI, through the shared distribution collector — this
 * plot contributes ONLY its contract and its AOI axis; pooling, statistics,
 * ordering and scale are `collectDistribution`'s, identically to the
 * Eye-movement Comparison.
 */
export function getAoiComparisonData(
  engine: DataEngine,
  settings: AoiComparisonDataSettings
): DistributionResult {
  const meta = engine.metadata
  if (!meta) throw new Error('No metadata found')

  return collectDistribution({
    instances: meta.metricInstances,
    contract: AOI_COMPARISON_CONTRACT,
    settings,
    axis: () => aoiAxis(engine, settings, meta.noAoiTreatment),
  })
}

/**
 * The AOI axis: one slot per AOI of the plot's AOI SELECTION, plus the No-AOI
 * pseudo-slot last unless `hideNoAoi` drops it. Slot indices are the vector
 * indices the metric's result is indexed by, so the No-AOI slot is always
 * `aois.length` — never a re-numbering.
 */
function aoiAxis(
  engine: DataEngine,
  settings: AoiComparisonDataSettings,
  noAoiTreatment: { displayedName: string; color: string }
): DistributionAxis {
  const aois = getAois(engine, settings.stimulusId, settings.aoiSelectionId)
  const slots: DistributionSlot[] = aois.map((aoi, slot) => ({
    slot,
    label: aoi.displayedName,
    color: aoi.color,
  }))
  if (!(settings.hideNoAoi ?? false)) {
    slots.push({
      slot: aois.length,
      label: noAoiTreatment.displayedName,
      color: noAoiTreatment.color,
    })
  }

  return { slots, ...distributionParticipants(engine, settings) }
}
