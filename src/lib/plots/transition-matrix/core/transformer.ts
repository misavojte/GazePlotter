import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
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

const CONTRACT = { outputShape: 'aoi-pair-matrix', windowing: 'forbidden', crossParticipant: 'reduce' } as const satisfies PlotMetricContract

export function getTransitionMatrixData(
  engine: DataEngine,
  stimulusId: number,
  groupId: number,
  metricInstanceId: string | null,
  timeStart: number = 0,
  timeEnd: number = 0,
  hideNoAoi: boolean = false,
): TransitionMatrixData {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  const aoiList = getAois(engine, stimulusId)
  const aoiCount = aoiList.length
  const size = hideNoAoi ? aoiCount : aoiCount + 1
  const aoiLabels = [
    ...aoiList.map(a => a.displayedName),
  ]
  if (!hideNoAoi) {
    aoiLabels.push(meta.noAoiTreatment.displayedName)
  }

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
  const result = asAoiPairMatrix(queryGroup(resolved.instance, scope))
  let rawMatrix = result ? Float64Array.from(result.matrix) : new Float64Array(0)

  if (hideNoAoi && rawMatrix.length > 0) {
    const origSize = aoiCount + 1
    const filtered = new Float64Array(aoiCount * aoiCount)
    for (let r = 0; r < aoiCount; r++) {
      for (let c = 0; c < aoiCount; c++) {
        filtered[r * aoiCount + c] = rawMatrix[r * origSize + c]
      }
    }
    rawMatrix = filtered
  }

  return {
    matrix: rawMatrix,
    aoiLabels,
    aoiList,
  }
}
