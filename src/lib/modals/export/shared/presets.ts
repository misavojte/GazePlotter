/**
 * Selection chips over an export checklist: a saved selection is a one-click
 * preset of member keys, never an export parameter. Shared by every step that
 * pairs chips with checkmarks (participants, eye-movement types, event channels).
 */
import { listSummary } from './helpers'

export type SelectionPreset = {
  id: number
  name: string
  /** Checklist keys the chip ticks. */
  members: readonly string[]
}

/** A chip reads active when every member is ticked. */
export function isPresetSelected(
  members: readonly string[],
  selected: ReadonlySet<string>
): boolean {
  return members.length > 0 && members.every(key => selected.has(key))
}

/** Chip click: tick the whole selection, or untick it when fully ticked. */
export function togglePreset(
  members: readonly string[],
  selected: ReadonlySet<string>
): Set<string> {
  const next = new Set(selected)
  const remove = isPresetSelected(members, selected)
  for (const key of members) {
    if (remove) next.delete(key)
    else next.add(key)
  }
  return next
}

/**
 * One-line step-header readout. Ticks that exactly equal a selection read as
 * that selection ("Experts (12)"); otherwise the standard {@link listSummary}.
 */
export function presetSelectionSummary(
  items: readonly { value: string; label: string }[],
  presets: readonly SelectionPreset[],
  selected: ReadonlySet<string>
): string {
  // Ticks on items not listed (kept while a narrower list shows) don't count.
  const count = items.filter(item => selected.has(item.value)).length
  if (count > 0 && count < items.length) {
    const exact = presets.find(
      p => p.members.length === count && isPresetSelected(p.members, selected)
    )
    if (exact) return `${exact.name} (${count})`
  }
  const single =
    count === 1 ? items.find(item => selected.has(item.value))?.label : undefined
  return listSummary(count, items.length, single)
}
