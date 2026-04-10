import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois, getParticipantsIds } from '$lib/data/engine'
import type {
  SimilarityMethod,
  ScanpathSimilarityData,
  ScangraphData,
} from '../types'
import { collectAllScanpaths } from './collector'
import {
  levenshteinSimilarity,
  needlemanWunschSimilarity,
} from './similarity'

const similarityFn: Record<
  SimilarityMethod,
  (a: string, b: string) => number
> = {
  levenshtein: levenshteinSimilarity,
  needlemanWunsch: needlemanWunschSimilarity,
}

/**
 * Compute the pairwise similarity matrix for all participants.
 */
export function getScanpathSimilarityData(
  engine: DataEngine,
  stimulusId: number,
  groupId: number,
  method: SimilarityMethod,
  collapsed: boolean
): ScanpathSimilarityData {
  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  const meta = engine.metadata
  const aois = meta?.aois.data[stimulusId] ? getAois(engine, stimulusId) : []
  const entries = collectAllScanpaths(
    engine,
    stimulusId,
    participantIds,
    aois,
    collapsed
  )

  const size = entries.length
  const matrix = new Float64Array(size * size)
  const labels = entries.map(e => e.label)
  const pids = entries.map(e => e.participantId)
  const compute = similarityFn[method]

  for (let i = 0; i < size; i++) {
    matrix[i * size + i] = 1 // Self-similarity = 1
    for (let j = i + 1; j < size; j++) {
      const sim = compute(entries[i].scanpath, entries[j].scanpath)
      const rounded = Math.round(sim * 1000) / 1000
      matrix[i * size + j] = rounded
      matrix[j * size + i] = rounded
    }
  }

  return { labels, participantIds: pids, matrix, size }
}

/**
 * Build scangraph adjacency from the similarity matrix using a threshold.
 * Nodes with fewer than 1 connection are kept (isolated nodes still shown).
 */
export function buildScangraphData(
  simData: ScanpathSimilarityData,
  threshold: number
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
