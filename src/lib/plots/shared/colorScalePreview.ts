import { interpolateColor } from '$lib/color/utility'

export interface ColorScaleFields {
  colorMin: string
  colorMiddle: string
  colorMax: string
}

/**
 * Extract committed color scale fields from a settings.colorScale array.
 * Handles 2-color (auto middle) and 3-color (explicit middle) formats.
 */
export function getColorScaleCommitted(
  colorScale: string[] | undefined,
  defaultMin: string,
  defaultMax: string
): ColorScaleFields {
  const colorMin = colorScale?.[0] || defaultMin
  const colorMax =
    colorScale?.length === 3
      ? colorScale[2]
      : colorScale?.[1] || defaultMax

  const colorMiddle =
    colorScale?.length === 3
      ? colorScale[1]
      : interpolateColor(colorMin, colorMax, 0.5)

  return { colorMin, colorMiddle, colorMax }
}

/**
 * Build the colorScale patch value from draft color fields.
 * Returns null if no color changed; otherwise returns the optimized
 * 2-or-3-element array.
 */
export function buildColorScalePatch(
  draft: ColorScaleFields,
  committed: ColorScaleFields
): string[] | null {
  const changed =
    draft.colorMin !== committed.colorMin ||
    draft.colorMiddle !== committed.colorMiddle ||
    draft.colorMax !== committed.colorMax

  if (!changed) return null

  const autoMiddle = interpolateColor(draft.colorMin, draft.colorMax, 0.5)
  return draft.colorMiddle === autoMiddle
    ? [draft.colorMin, draft.colorMax]
    : [draft.colorMin, draft.colorMiddle, draft.colorMax]
}

/**
 * Derive the effective color scale from draft fields.
 * Optimizes to 2-element when middle is the auto-interpolated value.
 */
export function deriveEffectiveColorScale(
  draft: ColorScaleFields
): string[] {
  const autoMiddle = interpolateColor(draft.colorMin, draft.colorMax, 0.5)
  if (draft.colorMiddle === autoMiddle) return [draft.colorMin, draft.colorMax]
  return [draft.colorMin, draft.colorMiddle, draft.colorMax]
}
