import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotDefinition } from '$lib/plots/definePlot'

type HighlightSettings = { stimulusId: number; highlights?: string[] }

/**
 * `onCommand` for plots whose legend `highlights` name stimulus-scoped
 * entities (AOIs, event channels): their ids live per stimulus, so an id
 * carried across a stimulus switch is at best meaningless and at worst another
 * entity's. After every root command the item's highlights are reconciled:
 * - a stimulus switch on THIS item drops every stimulus-scoped highlight (an
 *   id may exist in both stimuli, so "still valid" is undecidable — nothing
 *   survives);
 * - any other command drops the stimulus-scoped highlights the plot can no
 *   longer honor (AOI merged away, channel deleted, ...), keeping the ones in
 *   `currentIdentifiers`.
 * Highlights `isStimulusScoped` rejects (e.g. scarf's global eye-movement
 * categories) are never touched. Dispatches nothing when nothing changes.
 */
export const reconcileStimulusScopedHighlights =
  <TSettings extends HighlightSettings>(
    isStimulusScoped: (identifier: string) => boolean,
    currentIdentifiers: (engine: DataEngine, settings: TSettings) => Iterable<string>
  ): NonNullable<PlotDefinition<string, TSettings>['onCommand']> =>
  (command, item, engine, dispatch) => {
    const highlights = item.settings.highlights ?? []
    if (highlights.length === 0) return
    const switched =
      command.type === 'updateSettings' &&
      command.updates.some(u => u.itemId === item.id && 'stimulusId' in u.settings)
    const valid = switched ? null : new Set(currentIdentifiers(engine, item.settings))
    const kept = highlights.filter(
      h => !isStimulusScoped(h) || (valid !== null && valid.has(h))
    )
    if (kept.length === highlights.length) return
    dispatch({
      type: 'updateSettings',
      updates: [{ itemId: item.id, settings: { highlights: kept } }],
      source: 'plot.onCommand',
    })
  }
