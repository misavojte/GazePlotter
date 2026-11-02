/**
 * Cross-plot max sync (value axis, color scale, timeline): comparable plots
 * register their own data max under a group key in a named channel and read
 * the group's largest. Push-based, so never scan `grid.items`; export never
 * syncs. Each channel is its own `SvelteMap` because in-place `.set()` on a
 * `$state(new Map())` would not notify readers.
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

/** A plot's part in a sync group: the tuple it matches on and its own max. */
export interface SyncContribution {
  key: readonly unknown[]
  own: number
}

/**
 * Registers this plot's max in `channel` and returns a reader for the group's
 * max when it beats the plot's own, else `null`. A `null` contribution opts
 * out of both, which is how a user-set range wins. Call at screen-recipe init.
 */
export function useSyncedMax(
  ctx: { readonly item: { id: number } },
  channel: string,
  contribution: () => SyncContribution | null
): () => number | null {
  const channels = sessionChannels()
  let sync = channels.get(channel)
  if (!sync) channels.set(channel, (sync = new PlotSyncChannel()))
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
