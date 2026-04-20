import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois, getParticipantsIds } from '$lib/data/engine'
import {
  queryGroup,
  resolveInstanceWithFallback,
  type GroupScope,
  type MetricResult,
} from '$lib/metrics'
import type { TransitionMatrixData } from '../types'

/** Plot's declared fallback when the user's picked instance has been deleted. */
const FALLBACK_BASE_ID = 'transitionCount'

export function getTransitionMatrixData(
  engine: DataEngine,
  stimulusId: number,
  groupId: number,
  metricInstanceId: number | null,
): TransitionMatrixData {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  const aoiList = getAois(engine, stimulusId)
  const size = aoiList.length + 1
  const aoiLabels = [
    ...aoiList.map(a => a.displayedName),
    meta.noAoiTreatment.displayedName,
  ]

  const instance = resolveInstanceWithFallback(
    metricInstanceId,
    FALLBACK_BASE_ID,
    meta.metricInstances ?? [],
  )
  if (!instance || participantIds.length === 0) {
    return { matrix: new Float64Array(size * size), aoiLabels, aoiList }
  }

  const scope: GroupScope = { engine, stimulusId, participantIds }
  const matrix = matrixOf(queryGroup(instance, scope))
  return { matrix, aoiLabels, aoiList }
}

function matrixOf(result: MetricResult): Float64Array {
  if (result.shape !== 'aoi-pair-matrix') return new Float64Array(0)
  return Float64Array.from(result.matrix)
}
