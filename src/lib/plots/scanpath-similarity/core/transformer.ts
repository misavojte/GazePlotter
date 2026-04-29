import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getParticipantsIds } from '$lib/data/engine'
import {
  queryGroup,
  type GroupScope,
  type MetricResult,
  type PlotMetricContract,
} from '$lib/metrics'
import {
  asParticipantPairMatrix,
  resolveContractedInstance,
} from '$lib/plots/shared'
import type { ScanpathSimilarityData, ScangraphData } from '../types'

const CONTRACT = { outputShape: 'participant-pair-matrix', windowing: 'forbidden' } as const satisfies PlotMetricContract

/**
 * Resolve the configured metric instance and run `queryGroup` to obtain the
 * participant-pair similarity matrix. Returns `noMetric: true` when the
 * configured metric instance is missing — the plot then renders a placeholder.
 */
export function getScanpathSimilarityData(
  engine: DataEngine,
  stimulusId: number,
  groupId: number,
  metricInstanceId: string | null,
): ScanpathSimilarityData {
  const meta = engine.metadata
  if (!meta) {
    return { labels: [], participantIds: [], matrix: new Float64Array(0), size: 0 }
  }

  const resolution = resolveContractedInstance(meta.metricInstances, metricInstanceId, CONTRACT)
  if (!resolution.ok) {
    return { labels: [], participantIds: [], matrix: new Float64Array(0), size: 0, noMetric: true }
  }

  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  if (participantIds.length === 0) {
    return { labels: [], participantIds: [], matrix: new Float64Array(0), size: 0 }
  }

  const scope: GroupScope = { engine, stimulusId, participantIds }
  const result = asParticipantPairMatrix(queryGroup(resolution.instance, scope))
  if (!result) {
    return { labels: [], participantIds: [], matrix: new Float64Array(0), size: 0, noMetric: true }
  }

  const labels = labelsFor(engine, result.participantIds)
  return {
    labels,
    participantIds: result.participantIds,
    matrix: Float64Array.from(result.matrix),
    size: result.size,
  }
}

function labelsFor(engine: DataEngine, participantIds: readonly number[]): string[] {
  const meta = engine.metadata
  if (!meta) return participantIds.map(pid => `P${pid}`)
  return participantIds.map(pid =>
    meta.participants.data[pid]?.[1] ?? meta.participants.data[pid]?.[0] ?? `P${pid}`,
  )
}

/**
 * Build scangraph adjacency from the similarity matrix using a threshold.
 * Nodes with fewer than 1 connection are kept (isolated nodes still shown).
 */
export function buildScangraphData(
  simData: ScanpathSimilarityData,
  threshold: number,
): ScangraphData {
  const { labels, size, matrix } = simData

  const nodes: ScangraphData['nodes'] = labels.map((label, i) => ({
    id: i,
    label,
    group: 0,
  }))

  const links: ScangraphData['links'] = []
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const sim = matrix[i * size + j]
      if (sim >= threshold) {
        links.push({ source: i, target: j, value: sim })
      }
    }
  }

  return { nodes, links }
}

// Re-export MetricResult for type consumers, in case callers need the raw shape.
export type { MetricResult }
