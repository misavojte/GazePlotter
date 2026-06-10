/**
 * Legacy grid-item `type` keys mapped to current plot-registry keys.
 *
 * Lives in its own module (instead of `registry.ts`) so worker-side code —
 * the ingest workspace migrations — can normalize old workspace files
 * without pulling Svelte plot components into the worker bundle.
 */
export const LEGACY_VISUALIZATION_TYPES = {
  TransitionMatrix: 'transitionMatrix',
} as const
