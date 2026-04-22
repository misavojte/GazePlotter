import type { Projection } from './core/projection'

/**
 * Seed for a starter instance emitted into a fresh workspace's metric library.
 * Missing fields fall back to:
 *   - `projection`: identity for the recipe's raw shape
 *   - `params`    : empty object (recipes' own param defaults are applied at evaluation time)
 *   - `label`     : `defaultInstanceLabel(baseId, params, projection)`
 */
export interface StartingMetricSpec {
  /**
   * Stable human-readable slug. Forms the workspace-level `MetricInstance.id`.
   * User-created instances use `crypto.randomUUID()` — so hand-authored slugs
   * and runtime UUIDs share the `string` namespace without colliding.
   *
   * Append-only: never rename a slug that's already shipped, and never reuse
   * a deleted one — some saved workspace out there might still reference it.
   */
  id: string
  baseId: string
  params?: Record<string, unknown>
  projection?: Projection
  label?: string
}

/**
 * Every metric instance seeded into a fresh project. Order is presentation-only
 * (it's what the library sidebar renders first-pass); IDs are the source of
 * truth for identity.
 */
export const STARTING_METRICS: readonly StartingMetricSpec[] = [
  // ── identity starters ────────────────────────────────────────────────
  { id: 'absoluteTime',          baseId: 'absoluteTime' },
  { id: 'relativeTime',          baseId: 'relativeTime' },
  { id: 'visitCount',            baseId: 'averageEntries' },
  { id: 'visitDuration',         baseId: 'avgDwellDuration' },
  { id: 'fixationCount',         baseId: 'averageFixationCount' },
  { id: 'fixationDuration',      baseId: 'avgFixationDuration' },
  { id: 'timeToFirstFixation',   baseId: 'timeToFirstFixation' },
  { id: 'firstFixationDuration', baseId: 'avgFirstFixationDuration' },
  { id: 'rqaRec',                baseId: 'rqaRec' },
  { id: 'rqaDet',                baseId: 'rqaDet' },
  { id: 'rqaLam',                baseId: 'rqaLam' },

  // ── windowed starters ────────────────────────────────────────────────
  {
    id: 'absoluteTime-windowed',
    baseId: 'absoluteTime',
    projection: {
      kind: 'windowed',
      window: { windowSize: 2000, stepSize: 2000 },
      inner: { kind: 'aggregate-aoi', reducer: 'mean' },
    },
  },
  {
    id: 'fixationCount-windowed',
    baseId: 'averageFixationCount',
    projection: {
      kind: 'windowed',
      window: { windowSize: 2000, stepSize: 2000 },
      inner: { kind: 'aggregate-aoi', reducer: 'mean' },
    },
  },
  {
    id: 'rqaDet-windowed',
    baseId: 'rqaDet',
    projection: {
      kind: 'windowed',
      window: { windowSize: 20, stepSize: 20 },
      inner: { kind: 'identity-scalar' },
    },
  },

  // ── matrix starters ──────────────────────────────────────────────────
  { id: 'transitionCount-fix',       baseId: 'transitionCount',       params: { mode: 'fixation' } },
  { id: 'transitionCount-visit',     baseId: 'transitionCount',       params: { mode: 'visit' } },
  { id: 'transitionProbability-fix', baseId: 'transitionProbability', params: { mode: 'fixation', step: 1 } },
  { id: 'transitionDwellMean-fix',   baseId: 'transitionDwellMean',   params: { mode: 'fixation' } },
  { id: 'transitionDwellMean-visit', baseId: 'transitionDwellMean',   params: { mode: 'visit' } },
]
