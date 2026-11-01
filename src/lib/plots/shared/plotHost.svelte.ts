/**
 * The platform's per-plot services, built once per grid item from the plot's
 * declarations (`cursor`, `sync`, `playback`, `view.viewOnly`): the settings
 * the view derives from (a drag draft and sync merged in), the input overlay,
 * and the `PlotHost` a kit acts through. Every rune a plot needs lives here, so
 * plot folders stay plain TS. Call during component init (`PlotContainer`).
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotItemContract, PlotSyncSpec, PlotView, PlotViewConfig, PlotCursorSpec } from '$lib/plots/definePlot'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import type { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import { toggleInArray } from './arrayUtils'
import { NO_CURSOR } from './cursorMarks'
import type { PlotHost } from './kit'
import { usePlaybackMembership } from './playback.svelte'
import type { PlaybackSettings } from './playbackFields'
import { plotCursorPort } from './plotCursor.svelte'
import { useSyncedMax } from './plotSync.svelte'

type Settings = Record<string, unknown>

/** The declarations a host reads, loosely typed: the container is generic over every plot. */
export interface PlotHostDefinition {
  view: Pick<PlotViewConfig<Settings, PlotView>, 'viewOnly'>
  cursor?: PlotCursorSpec<Settings>
  sync?: PlotSyncSpec<Settings, PlotView>[]
  playback?: boolean
}

export interface PlotHostServices {
  /** The settings the view derives from: committed or drafted, sync merged in. */
  settings: () => Settings
  /** The view's input with view-only settings and synced values merged over it. */
  input: (view: PlotView) => object
  host: PlotHost
}

export function usePlotHost(options: {
  definition: PlotHostDefinition
  item: () => PlotItemContract<string, Settings>
  engine: DataEngine
  workspace: WorkspaceCommandBus
  view: () => PlotView | null
}): PlotHostServices {
  const { definition, engine, workspace } = options
  const live = {
    get item() {
      return options.item()
    },
  }
  const source = () => createCommandSourcePlotPattern(live.item, 'plot')

  // The committed settings, or a draft a drag assigns over them. A writable
  // derived: it IS the committed object until assigned, and drops the draft by
  // itself once the committed settings change (the commit, an undo).
  let settings = $derived(live.item.settings)

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
          return options.view()
        },
        item: live.item,
        engine,
      })
    }),
  }))

  const derivedSettings = $derived.by(() => {
    let s = settings
    for (const { spec, max } of syncs) {
      const m = spec.settings ? max() : null
      if (m !== null) s = spec.settings!(s, m)
    }
    return s
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

  function input(view: PlotView): object {
    const merged: Record<string, unknown> = { ...view.input }
    const viewOnly = definition.view.viewOnly
    if (viewOnly) Object.assign(merged, viewOnly.input(settings, engine))
    for (const { spec, max } of syncs) {
      const m = spec.input ? max() : null
      if (m !== null) Object.assign(merged, spec.input!(view, m))
    }
    return merged
  }

  const host: PlotHost = {
    cursor: () => (port ? { times: port.times, participants: port.participants } : NO_CURSOR),
    publish: at => port?.publish(at),
    settings: () => settings,
    toggle(key, value) {
      const current = (live.item.settings[key] ?? []) as (string | number)[]
      workspace.updateItemSettings(live.item.id, { [key]: toggleInArray(current, value) }, source())
    },
    draft(patch) {
      settings = { ...settings, ...patch }
    },
    commit(patch) {
      const committed = live.item.settings
      const changes = patch ?? draftChanges(settings, committed)
      // One settings command per gesture: one undo step.
      if (Object.keys(changes).length > 0) {
        workspace.updateItemSettings(live.item.id, changes, source())
      }
      // Drops a draft the command did not apply (or a no-op gesture's).
      settings = live.item.settings
    },
    playback,
  }

  return { settings: () => derivedSettings, input, host }
}

/** The keys a draft changed against the committed settings. */
function draftChanges(draft: Settings, committed: Settings): Settings {
  const changes: Settings = {}
  for (const key of Object.keys(draft)) {
    if (draft[key] !== committed[key]) changes[key] = draft[key]
  }
  return changes
}
