/**
 * "Out of bounds" fills shared by every color-mapped plot (the matrices and the
 * AOI Timeline heatmap): the settings shape, its defaults, and the pane fields.
 *
 * Import this submodule by path from a `definition.ts`, never via the
 * `$lib/plots/shared` barrel: a helper called inside a `definePlot({...})`
 * literal otherwise hits the registry -> shared sections -> registry cycle.
 */
import { INACTIVE_COLOR } from '$lib/color/palettes'
import type { SectionField, SectionFieldCtx } from '$lib/plots/definePlot'

export type OutOfBoundsColors = {
  /** Fill for a value below the range minimum. Distinct from the gradient's own
   *  minimum color so a clipped cell never reads as a legitimate low value. */
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

/**
 * The "Out of bounds" caption group: a `Below min | Show text` row and an
 * `Above max | Show text` row. `labels: false` drops the toggles (the two colors
 * then share one row) for plots whose cells never print a value.
 */
export function outOfBoundsFields({
  labels = true,
  showWhen,
}: {
  labels?: boolean
  showWhen?: (ctx: SectionFieldCtx) => boolean
} = {}): SectionField[] {
  const shared = { group: 'Out of bounds', pair: true, showWhen }
  const fields: SectionField[] = [
    { kind: 'color', key: 'belowMinColor', label: 'Below min', ...shared },
    { kind: 'boolean', key: 'showBelowMinLabels', label: 'Show text', ...shared },
    { kind: 'color', key: 'aboveMaxColor', label: 'Above max', ...shared },
    { kind: 'boolean', key: 'showAboveMaxLabels', label: 'Show text', ...shared },
  ]
  return labels ? fields : fields.filter(f => f.kind === 'color')
}
