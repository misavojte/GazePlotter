import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getParticipantsIds, getParticipant } from '$lib/data/engine'
import {
  queryGroup,
  type GroupScope,
  type MetricResult,
  type PlotMetricContract,
} from '$lib/metrics'
import {
  asParticipantPairMatrix,
  resolveMetric,
} from '$lib/plots/shared'
import { maximalCliques } from './cliques'
import { SCANPATH_SIMILARITY_DEFAULTS } from '../const'
import type {
  ScanpathSimilarityData,
  ScanpathSimilaritySettings,
  ScangraphData,
} from '../types'

const CONTRACT = { outputShape: 'participant-pair-matrix', windowing: 'forbidden', crossParticipant: 'group-axis' } as const satisfies PlotMetricContract

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
  timeStart: number = 0,
  timeEnd: number = 0,
  aoiSelectionId?: number,
): ScanpathSimilarityData {
  const meta = engine.metadata
  if (!meta) {
    return { labels: [], participantIds: [], matrix: new Float64Array(0), size: 0 }
  }

  const resolved = resolveMetric({
    engine,
    id: metricInstanceId,
    contract: CONTRACT,
  })
  if (!resolved.ok) {
    return { labels: [], participantIds: [], matrix: new Float64Array(0), size: 0, noMetric: true }
  }

  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  if (participantIds.length === 0) {
    return { labels: [], participantIds: [], matrix: new Float64Array(0), size: 0 }
  }

  const scope: GroupScope = {
    engine,
    stimulusId,
    participantIds,
    timeStart,
    timeEnd,
    aoiSelectionId,
  }
  const result = asParticipantPairMatrix(queryGroup(resolved.instance, scope))
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
  return participantIds.map(pid => getParticipant(engine, pid).displayedName)
}

/**
 * The p that draws at most the requested share of COMPARABLE pairs: pair
 * similarities sorted descending, p lands on the last pair kept. Ties are
 * rounded DOWN (fewer edges), per the ScanGraph paper. NaN pairs (both
 * scanpaths empty — no data) can never be edges, so they count in neither
 * the numerator nor the denominator. Returns Infinity when nothing
 * qualifies, so `sim >= p` stays false for every pair.
 */
export function thresholdForEdgeShare(
  simData: ScanpathSimilarityData,
  percent: number,
): number {
  const { size, matrix } = simData
  const sims: number[] = []
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const v = matrix[i * size + j]
      if (Number.isFinite(v)) sims.push(v)
    }
  }
  // Multiply before dividing: 0.41 * 300 floats to 122.999…, and the floor
  // would silently drop an edge the exact share allows.
  const clamped = Math.min(Math.max(percent, 0), 100)
  const wanted = Math.floor((clamped * sims.length) / 100)
  if (wanted <= 0) return Infinity
  sims.sort((a, b) => b - a)
  const candidate = sims[wanted - 1]
  if (wanted < sims.length && sims[wanted] === candidate) {
    // A tie crossing the cut would overshoot; step up to the next distinct value.
    for (let k = wanted - 1; k >= 0; k--) {
      if (sims[k] > candidate) return sims[k]
    }
    return Infinity
  }
  return candidate
}

/**
 * The plot's similarity matrix for its full settings tuple, memoized for ONE
 * microtask: within a single synchronous burst the pane's read overrides, the
 * clique picker, onCommand, and the view all ask for the same tuple, and the
 * O(P² · L²) alignment pass is far too heavy to repeat per caller. The memo
 * self-clears before the next event can mutate the engine, so there are no
 * invalidation semantics to get wrong.
 */
let _simMemo: {
  engine: DataEngine
  key: string
  data: ScanpathSimilarityData
} | null = null

function settingsKey(settings: ScanpathSimilaritySettings): string {
  return [
    settings.stimulusId,
    settings.groupId,
    settings.metricInstanceIds[0] ?? '',
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0,
    settings.aoiSelectionId ?? 0,
  ].join('|')
}

export function similarityDataFor(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings
): ScanpathSimilarityData {
  const key = settingsKey(settings)
  if (_simMemo && _simMemo.engine === engine && _simMemo.key === key) {
    return _simMemo.data
  }
  const data = getScanpathSimilarityData(
    engine,
    settings.stimulusId,
    settings.groupId,
    settings.metricInstanceIds[0] ?? null,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0,
    settings.aoiSelectionId
  )
  _simMemo = { engine, key, data }
  queueMicrotask(() => {
    _simMemo = null
  })
  return data
}

/** Share of COMPARABLE pairs drawn as edges at `threshold`, in percent (NaN
 *  pairs are out of both counts, mirroring thresholdForEdgeShare). One
 *  decimal, except a nonzero share never rounds to 0 — the readout must not
 *  claim an empty graph while edges visibly draw. */
export function edgeSharePercent(
  simData: ScanpathSimilarityData,
  threshold: number
): number {
  const { size, matrix } = simData
  if (size < 2) return 0
  let edges = 0
  let comparable = 0
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const v = matrix[i * size + j]
      if (!Number.isFinite(v)) continue
      comparable++
      if (v >= threshold) edges++
    }
  }
  if (comparable === 0) return 0
  const pct = (edges / comparable) * 100
  const rounded = Math.round(pct * 10) / 10
  return edges > 0 && rounded === 0 ? Math.round(pct * 100) / 100 : rounded
}

export interface ScangraphClique {
  /** Content key: member participant ids, ascending, joined with '-'. A stored
   *  selection whose key no longer matches any clique silently deselects. */
  key: string
  /** Node indices into the scangraph's node order. */
  nodeIndices: number[]
  memberLabels: string[]
  /** The weakest internal pair: every member pair agrees at least this much. */
  minSimilarity: number
  /** Mean over all internal pairs, rounded like the matrix (3 decimals). */
  meanSimilarity: number
}

/** The cliques the picker offers and the view highlights: at least `minSize`
 *  members (floor 2 — a clique of one is not a clique). One rule for the
 *  pane's options, its displayed-value coercion, and the view's resolution. */
export function cliquesOfMinSize(
  cliques: ScangraphClique[] | null,
  minSize: number
): ScangraphClique[] | null {
  if (!cliques) return null
  const floor = Math.max(2, minSize)
  return cliques.filter(c => c.nodeIndices.length >= floor)
}

/** Maximal cliques of the thresholded graph, largest first; null when the
 *  graph is too dense to enumerate. */
export function scangraphCliques(
  simData: ScanpathSimilarityData,
  threshold: number
): ScangraphClique[] | null {
  if (simData.size < 2) return []
  const { links } = buildScangraphData(simData, threshold)
  const cliques = maximalCliques(simData.size, links)
  if (!cliques) return null
  return cliques.map(nodeIndices => {
    // Internal-agreement stats: all member pairs are edges (finite, >= p).
    let min = 1
    let sum = 0
    let pairs = 0
    for (let a = 0; a < nodeIndices.length; a++) {
      for (let b = a + 1; b < nodeIndices.length; b++) {
        const v = simData.matrix[nodeIndices[a] * simData.size + nodeIndices[b]]
        if (v < min) min = v
        sum += v
        pairs++
      }
    }
    return {
      key: nodeIndices
        .map(i => simData.participantIds[i])
        .sort((a, b) => a - b)
        .join('-'),
      nodeIndices,
      memberLabels: nodeIndices.map(i => simData.labels[i]),
      minSimilarity: min,
      meanSimilarity: Math.round((sum / pairs) * 1000) / 1000,
    }
  })
}

/** Engine-level wrapper for the pane's clique picker. Microtask-memoized like
 *  {@link similarityDataFor}: the picker's options and its displayed-value
 *  coercion both enumerate in the same render burst. */
let _cliqueMemo: {
  engine: DataEngine
  key: string
  cliques: ScangraphClique[] | null
} | null = null

export function getScangraphCliques(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings
): ScangraphClique[] | null {
  const threshold =
    settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold
  const key = `${settingsKey(settings)}|${threshold}`
  if (_cliqueMemo && _cliqueMemo.engine === engine && _cliqueMemo.key === key) {
    return _cliqueMemo.cliques
  }
  const cliques = scangraphCliques(similarityDataFor(engine, settings), threshold)
  _cliqueMemo = { engine, key, cliques }
  queueMicrotask(() => {
    _cliqueMemo = null
  })
  return cliques
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
