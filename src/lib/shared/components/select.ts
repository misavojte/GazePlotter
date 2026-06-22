import type {
  MenuActionItem,
  MenuComponentItem,
  MenuItem,
  MenuSubMenuItem,
} from '$lib/context-menu'

type SelectMenuItem = MenuActionItem | MenuSubMenuItem | MenuComponentItem

export type SelectOption = SelectMenuItem & {
  label: string
  value: string
}

export type SelectChangeEvent = CustomEvent<string | string[]>

export interface GroupSelectItem {
  options: readonly SelectOption[]
  label: string
  value: string
  disabled?: boolean
  ariaLabel?: string
  onchange?: (event: CustomEvent<string>) => void
  onClose?: () => void
}

export function createSelectChangeEvent(value: string): CustomEvent<string>
export function createSelectChangeEvent(
  value: readonly string[]
): CustomEvent<string[]>
export function createSelectChangeEvent(
  value: string | readonly string[]
): SelectChangeEvent {
  const detail: string | string[] =
    typeof value === 'string' ? value : [...value]
  return new CustomEvent<string | string[]>('change', { detail })
}

/**
 * Map a list of select options into menu items. Multi-select items keep the
 * menu open on click (toggle); single-select items close on click. The leading
 * radio/checkbox affordance is rendered by ContextMenu based on the menu's
 * `selectionMode`; this helper does not set per-item indicators.
 */
export function createSelectMenuItems(
  optionList: readonly SelectOption[],
  selection: string | readonly string[] | undefined,
  handleSelectionChange: (value: string) => void
): MenuItem[] {
  const isMulti = Array.isArray(selection)
  const selectedSet = isMulti ? new Set(selection) : null
  return optionList.map(option => ({
    ...option,
    closeOnAction: !isMulti,
    onAction: () => {
      handleSelectionChange(option.value)
      option.onAction?.(option.value)
    },
    isHighlighted: isMulti
      ? selectedSet!.has(option.value)
      : option.value === selection,
  }))
}

/**
 * Compute the trigger label for either single- or multi-select state.
 * - Single: matched option's label, else `placeholder`, else first option label.
 * - Multi: "Label A, Label B" for ≤2 selected, "{N} selected" for 3+, else placeholder.
 */
export function getSelectLabel(
  selection: string | readonly string[] | undefined,
  optionList: readonly SelectOption[],
  placeholder?: string
): string {
  if (Array.isArray(selection)) {
    const matched = optionList.filter(o => selection.includes(o.value))
    if (matched.length === 0) return placeholder ?? 'None selected'
    if (matched.length === 1) return matched[0].label
    return `${matched[0].label} + ${matched.length - 1}`
  }
  const single = optionList.find(o => o.value === selection)
  if (single) return single.label
  if (placeholder) return placeholder
  return optionList[0]?.label ?? ''
}

/** True when the current selection does not correspond to any visible option. */
export function isSelectionEmpty(
  selection: string | readonly string[] | undefined,
  optionList: readonly SelectOption[]
): boolean {
  if (Array.isArray(selection)) {
    return !selection.some(v => optionList.some(o => o.value === v))
  }
  return !optionList.some(o => o.value === selection)
}
