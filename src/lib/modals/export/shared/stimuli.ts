/**
 * Shared stimulus-selection logic for export modals, mirroring
 * `participants.ts`: an explicit Set of stimulus-id strings, initialized once
 * (never re-derived while the modal is open, so engine metadata edits cannot
 * silently reset the user's selection).
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getStimuliOptions } from '$lib/plots/shared'
import { listSummary } from './helpers'

/** Initial selection: a given stimulus only, else every stimulus. */
export function defaultStimulusSelection(
  engine: DataEngine,
  stimulusId?: number
): Set<string> {
  if (stimulusId != null) return new Set([stimulusId.toString()])
  return new Set(getStimuliOptions(engine).map(({ value }) => value))
}

/** One-line step-header readout. */
export function stimuliSelectionSummary(
  engine: DataEngine,
  selected: ReadonlySet<string>
): string {
  const options = getStimuliOptions(engine)
  const count = selected.size
  const single =
    count === 1 ? options.find(o => selected.has(o.value))?.label : undefined
  return listSummary(count, options.length, single)
}
