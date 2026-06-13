import type { PaneSectionItem } from '$lib/plots/definePlot'
import { getGazePlotterSession } from '$lib/session'
import { getPaneEditItems } from '$lib/workspace/pane/paneEditItems'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands/utils'

/**
 * Reduce a per-item value list to a single shared value plus a "mixed" flag.
 * Settings values are JSON-serialisable (numbers, strings, booleans, and arrays
 * like metricInstanceIds / colorScale / scaleRange) — a structural compare
 * handles arrays without per-field special-casing. `value` is ALWAYS a real
 * value (the common one, or the first item's when mixed) — never a sentinel —
 * so callers can `.charAt`/`[0]`/compare it freely.
 */
export function computeCommonValue<T>(values: T[]): { value: T; mixed: boolean } {
  const first = values[0]
  return { value: first, mixed: values.some(v => !valuesEqual(v, first)) }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The items a section edits: the live multi-selection, or just its own item. */
export function editTargets(
  getItems: (() => PaneSectionItem[]) | undefined,
  item: PaneSectionItem
): PaneSectionItem[] {
  return getItems ? getItems() : [item]
}

type UpdateSettings = ReturnType<
  typeof getGazePlotterSession
>['workspace']['updateItemsSettings']
type SettingsPatch = Parameters<UpdateSettings>[1]

/**
 * The single mechanism for selection-aware ("Mixed"-aware) pane sections.
 *
 * Divergence is ALWAYS computed from the real edit-target set — never from an
 * in-band marker in the value — so a control's value is always a real value and
 * "Mixed" is a first-class boolean. Cardinality-1: a single-plot pane is just a
 * set of one (no divergence), so the exact same section code drives single and
 * bulk editing.
 *
 * Call once at a section's top level (it reads Svelte context). Pass a getter
 * so the item is read reactively:
 *   const bulk = createBulkContext<MySettings>(() => item)
 *   const overlay = $derived(bulk.common(s => s.statisticalOverlay))
 *   <Radio value={overlay.value} mixed={overlay.mixed}
 *          onchange={e => bulk.update({ statisticalOverlay: e.detail })} />
 */
export function createBulkContext<S = Record<string, unknown>>(
  getItem: () => PaneSectionItem
) {
  const { workspace } = getGazePlotterSession()
  const getItems = getPaneEditItems()

  const targets = (): PaneSectionItem[] => editTargets(getItems, getItem())
  // Source tracks the live representative so command provenance stays correct
  // as the selection changes.
  const source = (): string =>
    createCommandSourcePlotPattern(targets()[0] ?? getItem(), 'pane')

  return {
    /** `{ value, mixed }` for one field, computed from the live selection. Call
     *  inside `$derived` so it re-tracks when the selection changes. */
    common<T>(read: (settings: S) => T): { value: T; mixed: boolean } {
      return computeCommonValue(targets().map(t => read(t.settings as S)))
    },
    /** Broadcast the same scalar patch to every selected plot (one undo step). */
    update(patch: Partial<S>): void {
      workspace.updateItemsSettings(
        targets().map(t => t.id),
        patch as SettingsPatch,
        source()
      )
    },
    /** Per-item read-modify-write: each plot's patch is computed from its OWN
     *  settings, so a keyed/partial edit never clobbers peers' other data. */
    updateEach(compute: (settings: S) => Partial<S> | null): void {
      workspace.updateEachItemSettings(
        targets().map(t => t.id),
        s => compute(s as S) as SettingsPatch | null,
        source()
      )
    },
  }
}
