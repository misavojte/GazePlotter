import { applyCategorySelection, getParticipant, getParticipantsIds } from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { categoryGroups, type PlotMetricContract } from '$lib/metrics'
import {
  collectDistribution,
  type DistributionAxis,
  type DistributionResult,
} from '$lib/plots/shared/distribution'
import type { EyeMovementComparisonSettings } from '../types'

/**
 * Category-vector instances only: the metric IS the per-type vector, and this
 * plot draws the whole vector as one distribution per type (identity
 * projection). Single types are a `pick-category` projection concern on scalar
 * plots, never a parameter.
 */
export const EYE_MOVEMENT_COMPARISON_CONTRACT = {
  outputShape: 'category-vector',
  windowing: 'forbidden',
  crossParticipant: 'distribution',
} as const satisfies PlotMetricContract

type EyeMovementComparisonDataSettings = Pick<
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

/**
 * One distribution per eye-movement type, straight off the library instance's
 * category-vector result (never a parallel computation), through the shared
 * distribution collector: this plot contributes ONLY its contract and its type
 * axis, exactly as the AOI Comparison contributes its AOI axis.
 */
export function getEyeMovementComparisonData(
  engine: DataEngine,
  settings: EyeMovementComparisonDataSettings
): DistributionResult {
  const meta = engine.metadata
  if (!meta) throw new Error('No metadata found')

  return collectDistribution({
    instances: meta.metricInstances,
    contract: EYE_MOVEMENT_COMPARISON_CONTRACT,
    settings,
    axis: () => typeAxis(engine, settings),
  })
}

/**
 * The type axis: the canonical `categoryGroups` order (the same contract the
 * recipes' vectors are indexed by, so each group keeps its slot), narrowed by
 * the per-plot eye-movement-type SELECTION — the same `applyCategorySelection`
 * gate the scarf uses. The Fixation group is in the axis like any other, so the
 * seeded "Just fixations" row leaves exactly one slot.
 */
function typeAxis(
  engine: DataEngine,
  settings: EyeMovementComparisonDataSettings
): DistributionAxis {
  const axis = categoryGroups(engine).map((g, slot) => ({ ...g, slot }))
  const { kept } = applyCategorySelection(
    engine,
    axis,
    settings.categorySelectionId
  )

  const participantIds = getParticipantsIds(
    engine,
    settings.groupId,
    settings.stimulusId
  )
  const timeStart = settings.timelineStart ?? 0
  const timeEnd = settings.timelineEnd ?? 0

  return {
    slots: kept.map(type => ({
      slot: type.slot,
      label: type.displayedName,
      color: type.color,
    })),
    scopes: participantIds.map(participantId => ({
      engine,
      stimulusId: settings.stimulusId,
      participantId,
      timeStart,
      timeEnd,
    })),
    participantNames: participantIds.map(
      id => getParticipant(engine, id).displayedName
    ),
  }
}
