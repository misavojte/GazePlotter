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

export type SelectChangeEvent = CustomEvent<string>

export interface GroupSelectItem {
  options: readonly SelectOption[]
  label: string
  value: string
  disabled?: boolean
  ariaLabel?: string
  onchange?: (event: SelectChangeEvent) => void
  onClose?: () => void
}

export function createSelectChangeEvent(
  value: string
): SelectChangeEvent {
  return new CustomEvent<string>('change', { detail: value })
}

export function createSelectMenuItems(
  optionList: readonly SelectOption[],
  currentValue: string,
  handleValueChange: (value: string) => void
): MenuItem[] {
  return optionList.map(option => ({
    ...option,
    onAction: () => {
      handleValueChange(option.value)
      option.onAction?.(option.value)
    },
    isHighlighted: option.value === currentValue,
  }))
}

export function getSelectLabel(
  currentValue: string | undefined,
  optionList: readonly SelectOption[]
): string {
  return (
    optionList.find(option => option.value === currentValue)?.label ??
    optionList[0]?.label ??
    ''
  )
}
