import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois, getParticipantsIds } from '$lib/data/engine'
import {
  queryGroup,
  type GroupScope,
  type PlotMetricContract,
} from '$lib/metrics'
import {
  asAoiPairMatrix,
  resolveMetric,
} from '$lib/plots/shared'
import type { TransitionMatrixData } from '../types'

const CONTRACT = { outputShape: 'aoi-pair-matrix', windowing: 'forbidden' } as const satisfies PlotMetricContract

export function getTransitionMatrixData(
  engine: DataEngine,
  stimulusId: number,
  groupId: number,
  metricInstanceId: string | null,
  timeStart: number = 0,
  timeEnd: number = 0,
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

  const resolved = resolveMetric({
    instances: meta.metricInstances,
    id: metricInstanceId,
    contract: CONTRACT,
  })
  if (!resolved.ok) {
    return { matrix: new Float64Array(size * size), aoiLabels, aoiList, noMetric: true }
  }
  if (participantIds.length === 0) {
    return { matrix: new Float64Array(size * size), aoiLabels, aoiList }
  }

  const scope: GroupScope = {
    engine,
    stimulusId,
    participantIds,
    timeStart,
    timeEnd,
  }
  const matrix = asAoiPairMatrix(queryGroup(resolved.instance, scope))
  return {
    matrix: matrix ? Float64Array.from(matrix.matrix) : new Float64Array(0),
    aoiLabels,
    aoiList,
  }
}
