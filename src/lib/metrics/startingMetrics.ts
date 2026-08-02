import type { Projection } from './core/projection'
import type { GroupReduction } from './core/measurement'

/** Seed for a starter instance in a fresh workspace's metric library. See
 *  `createMetricInstance` for what the optional fields fall back to. */
export interface StartingMetricSpec {
  /**
   * Becomes the workspace-level `MetricInstance.id`. APPEND-ONLY: never rename
   * a shipped slug and never reuse a deleted one — some saved workspace out
   * there may still reference it.
   *
   * Hence a few carry a legacy recipe-id prefix
   * (`avgFixationDuration-any-windowed` on `baseId: 'fixationDuration'`). Do
   * NOT "fix" those spellings.
   */
  id: string
  baseId: string
  params?: Record<string, unknown>
  projection?: Projection
  label?: string
  /** Set only where the starter's intended reading differs from the metric's
   *  conventional reduction — see the windowed AOI starters below. */
  reduction?: GroupReduction
}

/** Order is presentation-only; the ids are the identity. */
export const STARTING_METRICS: readonly StartingMetricSpec[] = [
  // ── identity starters ────────────────────────────────────────────────
  { id: 'absoluteTime', baseId: 'absoluteTime' },
  { id: 'relativeTime', baseId: 'relativeTime' },
  { id: 'visitCount', baseId: 'visitCount' },
  { id: 'visitDuration', baseId: 'visitDuration' },
  { id: 'fixationCount', baseId: 'fixationCount' },
  { id: 'fixationDuration', baseId: 'fixationDuration' },
  { id: 'fixated', baseId: 'fixated' },
  { id: 'timeToFirstFixation', baseId: 'timeToFirstFixation' },
  { id: 'firstFixationDuration', baseId: 'firstFixationDuration' },
  // The eye-movement family. Total before share, mirroring absoluteTime /
  // relativeTime on the AOI axis.
  { id: 'movementTime', baseId: 'movementTime' },
  { id: 'movementTimeShare', baseId: 'movementTimeShare' },
  { id: 'movementDuration', baseId: 'movementDuration' },
  { id: 'movementCount', baseId: 'movementCount' },

  // ── windowed starters ────────────────────────────────────────────────
  {
    // Legacy `avgFixationDuration-` prefix (see interface doc).
    id: 'avgFixationDuration-any-windowed',
    baseId: 'fixationDuration',
    label: 'Average fixation duration',
    projection: {
      kind: 'windowed',
      window: { windowSize: 1000, stepSize: 100 },
      // Explicit `mean` on every sample-summarizing starter: it IS a choice on
      // a summary leaf, so state it — the same normalization the configure
      // modal applies on edit.
      inner: { kind: 'pick-any-fixation', statistic: 'mean' },
    },
  },
  {
    id: 'fixationCount-any-windowed',
    baseId: 'fixationCount',
    label: 'Fixation count',
    projection: {
      kind: 'windowed',
      window: { windowSize: 1000, stepSize: 100 },
      inner: { kind: 'pick-any-fixation' },
    },
  },

  // ── windowed aoi-vector starters (aoi-stream consumers) ──────────────
  {
    id: 'absoluteTime-aoi-windowed-500',
    baseId: 'absoluteTime',
    label: 'Time on AOI',
    // Cohort total, not per-participant mean: a mean over only the
    // participants still recording never tapers, so a late window with two
    // stragglers reads as full height and hides the drop-off. Sum tapers
    // honestly. relativeTime (below) stays the per-participant share.
    reduction: 'sum',
    projection: {
      kind: 'windowed',
      window: { windowSize: 500, stepSize: 500 },
      inner: { kind: 'identity-aoi-vector' },
    },
  },
  {
    id: 'fixationCount-aoi-windowed-500',
    baseId: 'fixationCount',
    label: 'Fixation count per AOI',
    // Cohort total per window (same dropout reasoning as the time starter).
    reduction: 'sum',
    projection: {
      kind: 'windowed',
      window: { windowSize: 500, stepSize: 500 },
      inner: { kind: 'identity-aoi-vector' },
    },
  },
  {
    id: 'relativeTime-aoi-windowed-500',
    baseId: 'relativeTime',
    label: 'Relative time on AOI',
    projection: {
      kind: 'windowed',
      window: { windowSize: 500, stepSize: 500 },
      inner: { kind: 'identity-aoi-vector' },
    },
  },
  {
    id: 'visitCount-aoi-windowed-500',
    baseId: 'visitCount',
    label: 'Visit count per AOI',
    // Cohort total per window (same dropout reasoning as the time starter).
    reduction: 'sum',
    projection: {
      kind: 'windowed',
      window: { windowSize: 500, stepSize: 500 },
      inner: { kind: 'identity-aoi-vector' },
    },
  },

  // ── any-fixation starters ────────────────────────────────────────────
  {
    id: 'absoluteTime-any',
    baseId: 'absoluteTime',
    projection: { kind: 'pick-any-fixation' },
  },
  {
    id: 'visitCount-any',
    baseId: 'visitCount',
    projection: { kind: 'pick-any-fixation' },
  },
  {
    id: 'visitDuration-any',
    baseId: 'visitDuration',
    projection: { kind: 'pick-any-fixation', statistic: 'mean' },
  },
  {
    id: 'fixationCount-any',
    baseId: 'fixationCount',
    projection: { kind: 'pick-any-fixation' },
  },
  {
    id: 'fixationDuration-any',
    baseId: 'fixationDuration',
    projection: { kind: 'pick-any-fixation', statistic: 'mean' },
  },
  {
    id: 'timeToFirstFixation-any',
    baseId: 'timeToFirstFixation',
    projection: { kind: 'pick-any-fixation' },
  },
  {
    id: 'firstFixationDuration-any',
    baseId: 'firstFixationDuration',
    projection: { kind: 'pick-any-fixation' },
  },

  // ── matrix starters ──────────────────────────────────────────────────
  {
    id: 'transitionCount-fix',
    baseId: 'transitionCount',
    params: { mode: 'fixation' },
  },
  {
    id: 'transitionCount-visit',
    baseId: 'transitionCount',
    params: { mode: 'visit' },
  },
  {
    id: 'transitionProbability-fix',
    baseId: 'transitionProbability',
    params: { mode: 'fixation', step: 1 },
  },
  {
    id: 'transitionDwellMean-fix',
    baseId: 'transitionDwellMean',
    params: { mode: 'fixation' },
  },
  {
    id: 'transitionDwellMean-visit',
    baseId: 'transitionDwellMean',
    params: { mode: 'visit' },
  },
  {
    // One variant only, as with transitionProbability; the visit reading is
    // added from the library when wanted.
    id: 'transitionRelativeFrequency-fix',
    baseId: 'transitionRelativeFrequency',
    params: { mode: 'fixation' },
  },

  // ── rqa starters ──────────────────────────────────────────────────
  { id: 'rqaRec', baseId: 'rqaRec' },
  { id: 'rqaDet', baseId: 'rqaDet' },
  { id: 'rqaLam', baseId: 'rqaLam' },

  // ── scanpath similarity starters ──────────────────────────────────
  {
    id: 'participantPairSimilarity-lev',
    baseId: 'participantPairSimilarity',
    params: { method: 'levenshtein', collapsed: false },
  },
  {
    id: 'participantPairSimilarity-lev-collapsed',
    baseId: 'participantPairSimilarity',
    params: { method: 'levenshtein', collapsed: true },
  },
  {
    id: 'participantPairSimilarity-nw',
    baseId: 'participantPairSimilarity',
    params: { method: 'needlemanWunsch', collapsed: false },
  },
]
