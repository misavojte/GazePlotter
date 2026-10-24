/**
 * The AOI checklist of export dialogs: AOIs by displayed name across the
 * visible stimuli (the same displayed name is the same AOI everywhere), with
 * saved AOI selections as chips.
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getAois, getAoiSelections } from '$lib/data/engine'
import { getStimuliOptions } from '$lib/plots/shared'
import type { SelectionPreset } from './presets'

/** Displayed AOI names in first-seen order across the visible stimuli, or only the given ones. */
export function aoiChecklistItems(
  engine: DataEngine,
  stimulusIds?: ReadonlySet<string>
): { value: string; label: string }[] {
  const names = new Set<string>()
  for (const { value } of getStimuliOptions(engine)) {
    if (stimulusIds && !stimulusIds.has(value)) continue
    for (const aoi of getAois(engine, Number(value))) names.add(aoi.displayedName)
  }
  return Array.from(names, name => ({ value: name, label: name }))
}

/** AOI selections as chips, each covering its members present in `items`. */
export function aoiChecklistPresets(
  engine: DataEngine,
  items: readonly { value: string }[]
): SelectionPreset[] {
  const present = new Set(items.map(item => item.value))
  return getAoiSelections(engine)
    .map(s => ({ id: s.id, name: s.name, members: s.names.filter(name => present.has(name)) }))
    .filter(preset => preset.members.length > 0)
}

/** Initial ticks: a plot's AOI selection when given, else every AOI. */
export function defaultAoiSelection(
  engine: DataEngine,
  items: readonly { value: string }[],
  aoiSelectionId?: number
): Set<string> {
  const all = items.map(item => item.value)
  const selection = getAoiSelections(engine).find(s => s.id === aoiSelectionId)
  return new Set(selection ? all.filter(name => selection.names.includes(name)) : all)
}

/** The narrowing to send: the ticked listed AOIs, none when every listed AOI is ticked. */
export function tickedAoiNames(
  items: readonly { value: string }[],
  selected: ReadonlySet<string>
): Set<string> | undefined {
  const ticked = items.filter(item => selected.has(item.value)).map(item => item.value)
  return ticked.length === items.length ? undefined : new Set(ticked)
}
