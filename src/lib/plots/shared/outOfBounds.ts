/**
 * "Out of bounds" fills shared by every color-mapped plot (the matrices and the
 * AOI Timeline heatmap): the settings shape, its defaults, and the pane fields.
 *
 * Import this submodule by path from a `definition.ts`, never via the
 * `$lib/plots/shared` barrel: a helper called inside a `definePlot({...})`
 * literal otherwise hits the registry -> shared sections -> registry cycle.
 */
import { INACTIVE_COLOR } from '$lib/color/palettes'
import { commonIs, type SectionField, type SectionFieldCtx } from '$lib/plots/definePlot'

export type OutOfBoundsColors = {
  /** Fill for a value below the range minimum. Distinct from the gradient's own
   *  minimum color so a clipped cell never reads as a legitimate low value.
   *  Inert while the minimum is 0: no value falls below it. */
  belowMinColor: string
  /** Fill for a value above the range maximum. Inert while the maximum is left
   *  at 0 (auto): auto tracks the data max, which nothing exceeds. */
  aboveMaxColor: string
}

/** The fills plus a per-side "Show text" toggle, for plots that print cell values. */
export type OutOfBoundsSettings = OutOfBoundsColors & {
  showBelowMinLabels: boolean
  showAboveMaxLabels: boolean
}

export const OUT_OF_BOUNDS_COLORS: OutOfBoundsColors = {
  belowMinColor: INACTIVE_COLOR,
  aboveMaxColor: INACTIVE_COLOR,
}

export const OUT_OF_BOUNDS_DEFAULTS: OutOfBoundsSettings = {
  ...OUT_OF_BOUNDS_COLORS,
  showBelowMinLabels: false,
  showAboveMaxLabels: false,
}

/** The color range of a plot keyed per stimulus (`stimulusColorRange` field). */
export const stimulusColorRange = (s: any): readonly number[] | undefined =>
  s.stimuliColorValueRanges?.[s.stimulusId]

/**
 * The "Out of bounds" caption group: `Below min | Show text` and `Above max |
 * Show text` rows, each shown only while that end of `range` is set (0 = Auto).
 * `labels: false` drops the toggles for plots whose cells never print a value.
 */
export function outOfBoundsFields({
  labels = true,
  range = stimulusColorRange,
  showWhen,
}: {
  labels?: boolean
  /** The plot's color range [min, max]. */
  range?: (settings: any) => readonly number[] | undefined
  showWhen?: (ctx: SectionFieldCtx) => boolean
} = {}): SectionField[] {
  const endSet = (end: 0 | 1) => {
    const set = commonIs(s => (range(s)?.[end] ?? 0) > 0, true)
    return { group: 'Out of bounds', pair: true, showWhen: (ctx: SectionFieldCtx) => (showWhen?.(ctx) ?? true) && set(ctx) }
  }
  const below = endSet(0)
  const above = endSet(1)
  const fields: SectionField[] = [
    { kind: 'color', key: 'belowMinColor', label: 'Below min', ...below },
    { kind: 'boolean', key: 'showBelowMinLabels', label: 'Show text', ...below },
    { kind: 'color', key: 'aboveMaxColor', label: 'Above max', ...above },
    { kind: 'boolean', key: 'showAboveMaxLabels', label: 'Show text', ...above },
  ]
  return labels ? fields : fields.filter(f => f.kind === 'color')
}
