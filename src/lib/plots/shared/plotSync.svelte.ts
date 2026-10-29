/**
 * Cross-plot max sync (value axis, color scale, timeline): comparable plots
 * share the largest of their own data maxima, so same-shape figures read on
 * one scale. Push-based: each participating plot registers its own max under
 * a GROUP KEY in a named channel; readers take the max over the same key.
 * Never scan `grid.items` for sibling state. Export never syncs: only screen
 * recipes call `useSyncedMax`.
 *
 * Each channel is its own `SvelteMap`, so a scarf registering never
 * invalidates a heatmap's read. A plain `$state(new Map())` would NOT do:
 * in-place `.set()`/`.delete()` would never notify readers.
 */
import { SvelteMap } from 'svelte/reactivity'
import { sessionScoped } from '$lib/session/context'

interface SyncEntry {
  key: string
  dataMax: number
}

/** One sync channel: each participating plot's own max under its group key. */
export class PlotSyncChannel {
  private entries = new SvelteMap<number, SyncEntry>()

  set(plotId: number, entry: SyncEntry): void {
    this.entries.set(plotId, entry)
  }

  clear(plotId: number): void {
    this.entries.delete(plotId)
  }

  /** Largest max registered under `key`; `0` when nothing matches. */
  maxFor(key: string): number {
    let max = 0
    for (const e of this.entries.values()) {
      if (e.key === key && e.dataMax > max) max = e.dataMax
    }
    return max
  }
}

/** A group key compared as a tuple; JSON so no part's separator can collide. */
export const syncKey = (parts: readonly unknown[]): string => JSON.stringify(parts)

const sessionChannels = sessionScoped(() => new Map<string, PlotSyncChannel>())

/** This session's channel `name`; resolve at component init. */
export function plotSyncChannel(name: string): PlotSyncChannel {
  const channels = sessionChannels()
  let channel = channels.get(name)
  if (!channel) {
    channel = new PlotSyncChannel()
    channels.set(name, channel)
  }
  return channel
}

/** A plot's part in a sync group: the tuple it matches on and its own max. */
export interface SyncContribution {
  key: readonly unknown[]
  own: number
}

/**
 * Registers this plot's own max in `channel` and returns a reader for the
 * synced max: the group's largest when it beats the plot's own, else `null`.
 * A `null` contribution opts the plot out: it neither contributes nor reads,
 * which is how a user-set range wins over sync. Call once, at screen-recipe
 * init; the reader is reactive inside the recipe's `settings`/`props`.
 */
export function useSyncedMax(
  ctx: { readonly item: { id: number } },
  channel: string,
  contribution: () => SyncContribution | null
): () => number | null {
  const sync = plotSyncChannel(channel)
  const entry = $derived.by(() => {
    const c = contribution()
    return c ? { key: syncKey(c.key), dataMax: c.own } : null
  })

  $effect(() => {
    const id = ctx.item.id
    if (entry === null) sync.clear(id)
    else sync.set(id, entry)
    return () => sync.clear(id)
  })

  return () => {
    if (entry === null) return null
    const max = sync.maxFor(entry.key)
    return max > entry.dataMax ? max : null
  }
}
