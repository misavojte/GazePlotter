/**
 * Shared base for cross-plot sync registries (value-axis, color-axis, timeline).
 *
 * Plots that participate in cross-plot sync register a per-plot `Entry`
 * (carrying `dataMax` plus whatever match keys distinguish the sync group)
 * keyed by their grid item id. Reads consult `getSyncedMax(match)` to find
 * the largest `dataMax` across entries that satisfy a match predicate.
 *
 * The `SvelteMap` is the only Svelte-aware piece — readers depend on it for
 * reactivity, so subclasses don't need their own state plumbing. A plain
 * `$state(new Map())` would NOT do: `$state` only reacts to reassignment, so
 * in-place `.set()`/`.delete()` would never notify readers and synced maxima
 * would silently go stale. `SvelteMap` makes those mutations reactive. Each
 * concrete registry is a 5–10-line subclass that wraps `getSyncedMax` with a
 * shape-specific signature.
 */
import { SvelteMap } from 'svelte/reactivity'

export class PlotSyncRegistry<E extends { dataMax: number }> {
  protected entries = new SvelteMap<number, E>()

  /** Register or update a plot's contribution to its matching sync group. */
  setEntry(plotId: number, entry: E): void {
    this.entries.set(plotId, entry)
  }

  /** Remove a plot from the registry (call on component unmount). */
  clearEntry(plotId: number): void {
    this.entries.delete(plotId)
  }

  /**
   * Return the largest `dataMax` across entries that satisfy `match`. Returns
   * `0` when nothing matches — callers fall back to their own data max in that
   * case. Protected so each subclass exposes a `getSyncedMax(...)` method with
   * its own typed match-key signature, calling this internally.
   */
  protected maxWhere(match: (entry: E) => boolean): number {
    let max = 0
    for (const e of this.entries.values()) {
      if (match(e) && e.dataMax > max) {
        max = e.dataMax
      }
    }
    return max
  }
}

export function usePlotSync<E extends { dataMax: number }>(
  registry: PlotSyncRegistry<E>,
  getId: () => number,
  getEntry: () => E | null,
): void {
  $effect(() => {
    const id = getId()
    const entry = getEntry()
    if (entry === null) {
      registry.clearEntry(id)
    } else {
      registry.setEntry(id, entry)
    }
    return () => {
      registry.clearEntry(id)
    }
  })
}

