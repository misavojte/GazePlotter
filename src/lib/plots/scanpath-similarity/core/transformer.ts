import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getParticipantsIds, getParticipant } from '$lib/data/engine'
import { queryGroup, type GroupScope, type PlotMetricContract } from '$lib/metrics'
import { asShape, resolveMetric } from '$lib/plots/shared'
import { memoByRef } from '$lib/plots/shared/kit'
import { maximalCliques } from './cliques'
import { SCANPATH_SIMILARITY_DEFAULTS } from '../const'
import type {
  ScanpathSimilarityData,
  ScanpathSimilaritySettings,
  ScangraphData,
} from '../types'

const CONTRACT = { outputShape: 'participant-pair-matrix', windowing: 'forbidden', crossParticipant: 'group-axis' } as const satisfies PlotMetricContract

/** A fresh empty result. */
const empty = (extra?: { noMetric: true }): ScanpathSimilarityData =>
  ({ labels: [], participantIds: [], matrix: [], size: 0, ...extra })

/**
 * The plot's similarity matrix: its metric instance over its stimulus,
 * participants, time range and AOI selection. Cheap to call repeatedly: the
 * metric engine caches the matrix, and only the labels are rebuilt, so a
 * participant rename shows at once. `noMetric: true` when the configured
 * instance is missing; the plot then renders a placeholder.
 */
export function similarityDataFor(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings
): ScanpathSimilarityData {
  if (!engine.metadata) return empty()
  const resolved = resolveMetric({ engine, id: settings.metricInstanceIds[0] ?? null, contract: CONTRACT })
  if (!resolved.ok) return empty({ noMetric: true })
  const participantIds = getParticipantsIds(engine, settings, settings.stimulusId)
  if (participantIds.length === 0) return empty()

  const scope: GroupScope = {
    engine,
    stimulusId: settings.stimulusId,
    participantIds,
    timeStart: settings.timelineStart ?? 0,
    timeEnd: settings.timelineEnd ?? 0,
    aoiSelectionId: settings.aoiSelectionId,
  }
  const result = asShape(queryGroup(resolved.instance, scope), 'participant-pair-matrix')
  if (!result) return empty({ noMetric: true })
  return {
    labels: result.participantIds.map(pid => getParticipant(engine, pid).displayedName),
    participantIds: result.participantIds,
    matrix: result.matrix,
    size: result.size,
  }
}

/** Finite pair similarities, sorted descending, once per matrix (the engine
 *  hands out the same frozen matrix until its inputs change): the Auto
 *  threshold, its closest-pair fallback and the Edges readout all read it. */
const descendingSimilarities = memoByRef((matrix: ArrayLike<number>): Float64Array => {
  const size = Math.round(Math.sqrt(matrix.length))
  const finite: number[] = []
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const v = matrix[i * size + j]
      if (Number.isFinite(v)) finite.push(v)
    }
  }
  return Float64Array.from(finite).sort().reverse()
})

/**
 * The p that draws at most the requested share of COMPARABLE pairs: pair
 * similarities sorted descending, p lands on the last pair kept. Ties are
 * rounded DOWN (fewer edges), per the ScanGraph paper. NaN pairs (no data to
 * compare) can never be edges, so they count in neither the numerator nor the
 * denominator. Returns Infinity when nothing qualifies, so `sim >= p` stays
 * false for every pair.
 */
export function thresholdForEdgeShare(
  simData: ScanpathSimilarityData,
  percent: number,
): number {
  const sims = descendingSimilarities(simData.matrix)
  // Multiply before dividing: 0.41 * 300 floats to 122.999…, and the floor
  // would silently drop an edge the exact share allows.
  const clamped = Math.min(Math.max(percent, 0), 100)
  const wanted = Math.floor((clamped * sims.length) / 100)
  if (wanted <= 0) return Infinity
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
 * The p the graph is drawn at: `threshold`, or at 0 (Auto) the p drawing the
 * `edgePercent` share of pairs. Auto ranks pairs instead of fixing a cut, so
 * it suits metrics whose typical value sits high (heatmap overlap) as well as
 * edit-distance scores. When the share rounds down to no pair (a small study
 * at 5 %), Auto still links the closest pair rather than open on an empty graph.
 */
export function resolvedThreshold(
  simData: ScanpathSimilarityData,
  settings: Pick<ScanpathSimilaritySettings, 'threshold' | 'edgePercent'>
): number {
  const threshold = settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold
  if (threshold > 0) return threshold
  const percent = settings.edgePercent ?? SCANPATH_SIMILARITY_DEFAULTS.edgePercent
  const p = thresholdForEdgeShare(simData, percent)
  if (Number.isFinite(p)) return Math.min(p, 1)
  const closest = descendingSimilarities(simData.matrix)[0]
  return percent > 0 && closest > 0 ? closest : 1
}

/** Share of COMPARABLE pairs drawn as edges at `threshold`, in percent (NaN
 *  pairs are out of both counts, mirroring thresholdForEdgeShare). One
 *  decimal, except a nonzero share never rounds to 0 — the readout must not
 *  claim an empty graph while edges visibly draw. */
export function edgeSharePercent(
  simData: ScanpathSimilarityData,
  threshold: number
): number {
  const sims = descendingSimilarities(simData.matrix)
  if (sims.length === 0) return 0
  let edges = 0
  while (edges < sims.length && sims[edges] >= threshold) edges++
  const pct = (edges / sims.length) * 100
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

/** Enumerated cliques with their agreement stats, per edge list (itself
 *  memoized per matrix and threshold), so the pane's picker, its label and
 *  the view share one enumeration. Labels are added per call: renames show. */
const cliquesByLinks = new WeakMap<ScangraphData['links'], Omit<ScangraphClique, 'memberLabels'>[] | null>()

/** Maximal cliques of the thresholded graph, largest first; null when the
 *  graph is too dense to enumerate. */
export function scangraphCliques(
  simData: ScanpathSimilarityData,
  threshold: number
): ScangraphClique[] | null {
  const { size, matrix, participantIds, labels } = simData
  if (size < 2) return []
  const links = linksOf(simData, threshold)
  if (!cliquesByLinks.has(links)) {
    const found = maximalCliques(size, links)
    cliquesByLinks.set(
      links,
      found &&
        found.map(nodeIndices => {
          // Internal-agreement stats: all member pairs are edges (finite, >= p).
          let min = 1
          let sum = 0
          let pairs = 0
          for (let a = 0; a < nodeIndices.length; a++) {
            for (let b = a + 1; b < nodeIndices.length; b++) {
              const v = matrix[nodeIndices[a] * size + nodeIndices[b]]
              if (v < min) min = v
              sum += v
              pairs++
            }
          }
          return {
            key: nodeIndices.map(i => participantIds[i]).sort((a, b) => a - b).join('-'),
            nodeIndices,
            minSimilarity: min,
            meanSimilarity: Math.round((sum / pairs) * 1000) / 1000,
          }
        })
    )
  }
  const cliques = cliquesByLinks.get(links)!
  return cliques && cliques.map(c => ({ ...c, memberLabels: c.nodeIndices.map(i => labels[i]) }))
}

/** The pane's clique picker: the plot's cliques of at least its min members,
 *  at its resolved threshold. */
export function getScangraphCliques(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings
): ScangraphClique[] | null {
  const simData = similarityDataFor(engine, settings)
  return cliquesOfMinSize(
    scangraphCliques(simData, resolvedThreshold(simData, settings)),
    settings.minCliqueSize ?? 2
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
  const nodes: ScangraphData['nodes'] = simData.labels.map((label, i) => ({
    id: i,
    label,
    group: 0,
  }))
  return { nodes, links: linksOf(simData, threshold) }
}

/** Edge lists per matrix, for its four most recent thresholds. A redraw that
 *  changes neither (a clique pick, a rename) gets the same array, which keys
 *  the cliques and the force layout, so neither recomputes per redraw; typing
 *  thresholds by hand does not pin a list and a layout per value typed. */
const linksMemo = new WeakMap<object, Map<number, ScangraphData['links']>>()

function linksOf(simData: ScanpathSimilarityData, threshold: number): ScangraphData['links'] {
  const { size, matrix } = simData
  let byThreshold = linksMemo.get(matrix)
  if (!byThreshold) linksMemo.set(matrix, (byThreshold = new Map()))
  let links = byThreshold.get(threshold)
  if (links) return links
  links = []
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const sim = matrix[i * size + j]
      if (sim >= threshold) links.push({ source: i, target: j, value: sim })
    }
  }
  if (byThreshold.size >= 4) byThreshold.delete(byThreshold.keys().next().value!)
  byThreshold.set(threshold, links)
  return links
}
