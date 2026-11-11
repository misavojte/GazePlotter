/**
 * The platform's per-plot services, built once per grid item from the plot's
 * declarations (`cursor`, `sync`, `playback`, `highlights`, `view.viewOnly`): the view derived
 * from the settings (a drag draft and sync merged in), its input with the
 * platform's overlays, and the `PlotHost` a kit acts through. Every rune a plot
 * needs lives here, so plot folders stay plain TS and the container stays
 * markup. Call during component init (`PlotContainer`).
 */
import { untrack } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotItemContract, PlotView } from '$lib/plots/definePlot'
import { resolvePlotRuntime } from '$lib/plots/registry'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import type { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import type { GridItemMap, PlotType } from '$lib/workspace/grid/types'
import { getGazePlotterSession } from '$lib/session/context'
import { toggleInArray } from './arrayUtils'
import { linkedHighlightUpdates, type HighlightTarget } from './highlightLink'
import { NO_CURSOR } from './cursorMarks'
import type { PlotHost } from './kit'
import { usePlaybackMembership } from './playback.svelte'
import type { PlaybackSettings } from './playbackFields'
import { usePlotData, type PlotDataHandle } from './plotData.svelte'
import { plotCursorPort } from './plotCursor.svelte'
import { useSyncedMax } from './plotSync.svelte'

export interface PlotItemHost {
  /** The derived view; null while the plot has nothing to draw. */
  readonly view: PlotView | null
  /** The view's input with view-only settings and synced values merged over it. */
  readonly input: object | null
  readonly host: PlotHost
  /** The plot declares `playback`. */
  readonly playback: boolean
}

export function usePlotHost<K extends PlotType>(options: {
  item: () => GridItemMap[K]
  engine: DataEngine
  workspace: WorkspaceCommandBus
}): PlotItemHost {
  const { engine, workspace } = options
  const live = {
    get item() {
      return options.item()
    },
  }
  // `item.type` is stable for the item's lifetime (the grid keys by id).
  const definition = untrack(() => resolvePlotRuntime(live.item.type))
  const source = () => createCommandSourcePlotPattern(live.item, 'plot')

  // The committed settings, or a draft a drag assigns over them. A writable
  // derived: it IS the committed object until assigned, and drops the draft by
  // itself once the committed settings change (the commit, an undo).
  let settings = $derived(live.item.settings)

  // Bound below; sync offers read the view only later, from deriveds.
  let data: PlotDataHandle<PlotView | null> | null = null

  const syncs = (definition.sync ?? []).map(spec => ({
    spec,
    max: useSyncedMax(live, spec.channel, () => {
      // Offers may read the engine, whose data changes bump the epoch.
      void live.item.redrawTimestamp
      // `view` is read only by offers that ask for it: a settings-route offer
      // must not, as the view derives from the settings it feeds.
      return spec.offer({
        settings,
        get view() {
          return data?.current ?? null
        },
        item: live.item,
        engine,
      })
    }),
  }))

  const syncedSettings = $derived.by(() => {
    let s = settings
    for (const { spec, max } of syncs) {
      const m = spec.settings ? max() : null
      if (m !== null) s = spec.settings!(s, m)
    }
    return s
  })

  const view = usePlotData({
    epoch: () => live.item.redrawTimestamp,
    settings: () => syncedSettings,
    viewOnly: definition.view.viewOnly?.settings,
    watch: definition.view.viewDependsOnWidth ? () => live.item.w : undefined,
    derive: s =>
      definition.view.deriveView(engine, s, {
        itemWidth: live.item.w,
        itemHeight: live.item.h,
      }),
  })
  data = view

  const input = $derived.by(() => {
    const v = view.current
    if (!v) return null
    const merged: Record<string, unknown> = { ...v.input }
    const viewOnly = definition.view.viewOnly
    if (viewOnly) Object.assign(merged, viewOnly.input(settings, engine))
    for (const { spec, max } of syncs) {
      const m = spec.input ? max() : null
      if (m !== null) Object.assign(merged, spec.input!(v, m))
    }
    return merged
  })

  const cursorSpec = definition.cursor
  const port = cursorSpec
    ? plotCursorPort(live.item.id, {
        timeScope: cursorSpec.time && (() => cursorSpec.time!(settings)),
        stimulus: cursorSpec.stimulus && (() => cursorSpec.stimulus!(settings)),
        publishes: cursorSpec.publishes,
      })
    : null

  const playback = definition.playback
    ? usePlaybackMembership({
        get item() {
          return live.item as PlotItemContract<string, PlaybackSettings>
        },
        workspace,
      })
    : null

  // A legend click in a multi-selection highlights the same entity in the other
  // selected plots that declare `highlights`: one command, one undo step.
  const { grid } = getGazePlotterSession()
  function toggleHighlight(spec: HighlightTarget['spec'], identifier: string) {
    const { id } = live.item
    const settings = live.item.settings as HighlightTarget['settings']
    const others = grid.selectionMates(id).flatMap(i => {
      const other = resolvePlotRuntime(i.type).highlights
      // Only plots with a stimulus declare `highlights`.
      return other ? [{ id: i.id, settings: i.settings, spec: other } as HighlightTarget] : []
    })
    workspace.apply({
      type: 'updateSettings',
      updates: linkedHighlightUpdates({ id, settings, spec }, identifier, others),
      source: source(),
    })
  }

  const host: PlotHost = {
    cursor: () => (port ? { times: port.times, participants: port.participants } : NO_CURSOR),
    publish: at => port?.publish(at),
    settings: () => settings,
    toggle(key, value) {
      if (key === 'highlights' && definition.highlights) {
        return toggleHighlight(definition.highlights as HighlightTarget['spec'], String(value))
      }
      const current = (live.item.settings as Record<string, unknown>)[key] ?? []
      workspace.updateItemSettings(
        live.item.id,
        { [key]: toggleInArray(current as (string | number)[], value) },
        source()
      )
    },
    draft(patch) {
      settings = { ...settings, ...patch }
    },
    commit(patch) {
      const changes = patch ?? draftChanges(settings, live.item.settings)
      // One settings command per gesture: one undo step.
      if (Object.keys(changes).length > 0) {
        workspace.updateItemSettings(live.item.id, changes, source())
      }
      // Drops a draft the command did not apply (or a no-op gesture's).
      settings = live.item.settings
    },
    playback,
  }

  return {
    get view() {
      return view.current
    },
    get input() {
      return input
    },
    host,
    playback: definition.playback ?? false,
  }
}

/** The keys a draft changed against the committed settings. */
function draftChanges<S extends object>(draft: S, committed: S): Partial<S> {
  const changes: Partial<S> = {}
  for (const key of Object.keys(draft) as (keyof S)[]) {
    if (draft[key] !== committed[key]) changes[key] = draft[key]
  }
  return changes
}
