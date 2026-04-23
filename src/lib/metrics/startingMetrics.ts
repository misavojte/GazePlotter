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
   *
   * Some slugs carry the legacy recipe-id prefix (`avgFixationDuration-any-windowed`)
   * even though the `baseId` has since been renamed (`fixationDuration`). This
   * drift is deliberate: slugs are workspace-persisted identifiers and never
   * renamed; `baseId` is the recipe key and was normalised in the v5→v6
   * migration. Do NOT "fix" the slug spellings.
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
  { id: 'absoluteTime', baseId: 'absoluteTime' },
  { id: 'relativeTime', baseId: 'relativeTime' },
  { id: 'visitCount', baseId: 'visitCount' },
  { id: 'visitDuration', baseId: 'visitDuration' },
  { id: 'fixationCount', baseId: 'fixationCount' },
  { id: 'fixationDuration', baseId: 'fixationDuration' },
  { id: 'timeToFirstFixation', baseId: 'timeToFirstFixation' },
  { id: 'firstFixationDuration', baseId: 'firstFixationDuration' },

  // ── windowed starters ────────────────────────────────────────────────
  {
    // Slug retains the legacy `avgFixationDuration-` prefix (see interface doc).
    id: 'avgFixationDuration-any-windowed',
    baseId: 'fixationDuration',
    label: 'Average fixation duration',
    projection: {
      kind: 'windowed',
      window: { windowSize: 2000, stepSize: 100 },
      inner: { kind: 'pick-any-fixation' },
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
    projection: { kind: 'pick-any-fixation' },
  },
  {
    id: 'fixationCount-any',
    baseId: 'fixationCount',
    projection: { kind: 'pick-any-fixation' },
  },
  {
    id: 'fixationDuration-any',
    baseId: 'fixationDuration',
    projection: { kind: 'pick-any-fixation' },
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

  // ── rqa starters ──────────────────────────────────────────────────
  { id: 'rqaRec', baseId: 'rqaRec' },
  { id: 'rqaDet', baseId: 'rqaDet' },
  { id: 'rqaLam', baseId: 'rqaLam' },
]
