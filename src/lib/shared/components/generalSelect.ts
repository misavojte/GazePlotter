import type {
  MenuActionItem,
  MenuComponentItem,
  MenuItem,
  MenuSubMenuItem,
} from '$lib/context-menu'

type SelectMenuItem = MenuActionItem | MenuSubMenuItem | MenuComponentItem

export type GeneralSelectOption = SelectMenuItem & {
  label: string
  value: string
}

export type GeneralSelectChangeEvent = CustomEvent<string>

export interface GroupSelectItem {
  options: readonly GeneralSelectOption[]
  label: string
  value: string
  disabled?: boolean
  ariaLabel?: string
  onchange?: (event: GeneralSelectChangeEvent) => void
  onClose?: () => void
}

export function createGeneralSelectChangeEvent(
  value: string
): GeneralSelectChangeEvent {
  return new CustomEvent<string>('change', { detail: value })
}

export function createGeneralSelectMenuItems(
  optionList: readonly GeneralSelectOption[],
  currentValue: string,
  handleValueChange: (value: string) => void
): MenuItem[] {
  return optionList.map(option => ({
    ...option,
    onSelect: () => {
      handleValueChange(option.value)
      option.onSelect?.(option.value)
    },
    isHighlighted: option.value === currentValue,
  }))
}

export function getGeneralSelectLabel(
  currentValue: string | undefined,
  optionList: readonly GeneralSelectOption[]
): string {
  return (
    optionList.find(option => option.value === currentValue)?.label ??
    optionList[0]?.label ??
    ''
  )
}
