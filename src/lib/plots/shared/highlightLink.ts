/**
 * Legend highlights shared across a multi-selection: a legend click in a
 * selected plot sets the same entity in every other selected plot that can
 * show it, as one command. Plots name entities differently (Scarf `a12`, AOI
 * Timeline `12`), so a plot declares `highlights` on its definition to map its
 * identifiers to a shared entity and back.
 */

/** An entity a legend names; `stimulusId` is set for per-stimulus entities (AOIs, events). */
export type LinkedHighlight = { entity: string; stimulusId: number | null }

export type PlotHighlightSpec<TSettings> = {
  /** This plot's identifier as a shared entity; null keeps it to this plot. */
  share(identifier: string, settings: TSettings): LinkedHighlight | null
  /** The shared entity as this plot's identifier; null when this plot cannot show it. */
  local(highlight: LinkedHighlight, settings: TSettings): string | null
}

type Highlighted = { stimulusId: number; highlights?: string[] }

/**
 * The spec for legends whose identifiers are `prefix + id`, one prefix per kind
 * (the longest matching prefix wins), plus one fixed identifier for No AOI.
 * AOIs, No AOI and events are per stimulus; eye-movement categories are global.
 */
export function prefixedHighlights<S extends Highlighted>(ids: {
  aoi: string
  noAoi: string
  category?: string
  event?: string
}): PlotHighlightSpec<S> {
  const { noAoi, ...prefixes } = ids
  const kinds = Object.entries(prefixes).sort((a, b) => b[1].length - a[1].length)
  return {
    share(identifier, s) {
      if (identifier === noAoi) return { entity: 'noAoi', stimulusId: s.stimulusId }
      const kind = kinds.find(([, prefix]) => identifier.startsWith(prefix))
      if (!kind) return null
      return {
        entity: `${kind[0]}:${identifier.slice(kind[1].length)}`,
        stimulusId: kind[0] === 'category' ? null : s.stimulusId,
      }
    },
    local({ entity, stimulusId }, s) {
      if (stimulusId !== null && stimulusId !== s.stimulusId) return null
      if (entity === 'noAoi') return noAoi
      const colon = entity.indexOf(':')
      const prefix = prefixes[entity.slice(0, colon) as keyof typeof prefixes]
      return prefix === undefined ? null : prefix + entity.slice(colon + 1)
    },
  }
}

export type HighlightTarget = {
  id: number
  settings: Highlighted
  spec: PlotHighlightSpec<Highlighted>
}

/**
 * The `highlights` updates of one legend click: the clicked plot toggles
 * `identifier`, and every other target that can show the same entity takes the
 * clicked plot's new state (set, not toggled, so differing plots converge).
 */
export function linkedHighlightUpdates(
  clicked: HighlightTarget,
  identifier: string,
  others: readonly HighlightTarget[]
): { itemId: number; settings: { highlights: string[] } }[] {
  const own = clicked.settings.highlights ?? []
  const on = !own.includes(identifier)
  const updates = [
    {
      itemId: clicked.id,
      settings: { highlights: on ? [...own, identifier] : own.filter(h => h !== identifier) },
    },
  ]
  const shared = clicked.spec.share(identifier, clicked.settings)
  if (!shared) return updates
  for (const other of others) {
    const local = other.spec.local(shared, other.settings)
    const current = other.settings.highlights ?? []
    if (local === null || current.includes(local) === on) continue
    updates.push({
      itemId: other.id,
      settings: { highlights: on ? [...current, local] : current.filter(h => h !== local) },
    })
  }
  return updates
}
