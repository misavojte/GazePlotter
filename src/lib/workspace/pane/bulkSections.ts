/**
 * Which sections to show when a multi-selection spans several plot TYPES:
 * the section keys present in EVERY selected type's pane, limited to the
 * cross-type-safe shared sections, in the representative type's declared order.
 *
 * Pure — no plot-type knowledge lives here; commonality is derived purely by
 * intersecting the per-type section-key lists.
 *
 * @param repKeys      the representative type's section keys, in display order
 * @param perTypeKeys  every selected type's section keys (including the rep's)
 * @param sharedKeys   the set of cross-type-safe shared section keys
 */
export function commonSectionKeys(
  repKeys: string[],
  perTypeKeys: string[][],
  sharedKeys: ReadonlySet<string>
): string[] {
  return repKeys
    .filter(key => sharedKeys.has(key))
    .filter(key => perTypeKeys.every(keys => keys.includes(key)))
}
