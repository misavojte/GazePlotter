import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois, getParticipantsIds } from '$lib/data/engine'
import {
  queryGroup,
  resolveInstance,
  type GroupScope,
  type MetricResult,
} from '$lib/metrics'
import type { TransitionMatrixData } from '../types'

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

  const instance = resolveInstance(meta.metricInstances ?? [], metricInstanceId)
  if (!instance) {
    return { matrix: new Float64Array(size * size), aoiLabels, aoiList, noMetric: true }
  }
  if (participantIds.length === 0) {
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
