import { beforeEach, describe, expect, it } from 'vitest'
import type { Component } from 'svelte'
import {
  clearOwnedContextMenu,
  highlightMenuItem,
  isMenuActionActivationKey,
  isOwnedContextMenuState,
  shouldCloseMenuOnAction,
} from '../src/lib/context-menu/behavior'
import { contextMenuState } from '../src/lib/context-menu/contextMenuState.svelte'
import {
  createMenuComponentItem,
  isMenuComponentItem,
  isMenuFlyoutItem,
  type MenuActionItem,
  type MenuComponentBridgeProps,
  type MenuItem,
} from '../src/lib/context-menu/types'
import {
  createSelectMenuItems,
  getSelectLabel,
  type SelectOption,
} from '../src/lib/shared/components/select'

const mockComponent =
  {} as unknown as Component<Record<string, unknown> & MenuComponentBridgeProps>

describe('select and context-menu primitives', () => {
  beforeEach(() => {
    contextMenuState.reset()
  })

  it('maps select options into highlighted menu items and preserves option actions', () => {
    const calls: string[] = []
    const options: SelectOption[] = [
      {
        label: 'First',
        value: 'first',
        onAction: value => calls.push(`option:${value}`),
      },
      {
        label: 'Second',
        value: 'second',
      },
    ]

    const items = createSelectMenuItems(options, 'second', value =>
      calls.push(`change:${value}`)
    )
    const [firstItem, secondItem] = items as MenuActionItem[]

    expect(firstItem.isHighlighted).toBe(false)
    expect(secondItem.isHighlighted).toBe(true)

    firstItem.onAction?.('ignored')

    expect(calls).toEqual(['change:first', 'option:first'])
    expect(getSelectLabel('second', options)).toBe('Second')
    expect(getSelectLabel('missing', options)).toBe('First')
    expect(getSelectLabel(undefined, [])).toBe('')
  })

  it('keeps menu component items on the flyout path and exposes activation helpers', () => {
    const componentItem = createMenuComponentItem<Record<string, unknown>>({
      label: 'Custom',
      value: 'custom',
      component: mockComponent,
      componentProps: { tone: 'compact' },
    })
    const flyoutItem = {
      label: 'Submenu',
      children: [] satisfies MenuItem[],
    }

    expect(isMenuComponentItem(componentItem)).toBe(true)
    expect(isMenuFlyoutItem(componentItem)).toBe(true)
    expect(isMenuFlyoutItem(flyoutItem)).toBe(true)
    expect(isMenuActionActivationKey('Enter')).toBe(true)
    expect(isMenuActionActivationKey(' ')).toBe(true)
    expect(isMenuActionActivationKey('Escape')).toBe(false)
  })

  it('tracks menu ownership, highlighting, and close-on-action semantics', () => {
    const ownerId = Symbol('owner')
    const otherOwnerId = Symbol('other-owner')
    const items: MenuItem[] = [
      { label: 'Open', isHighlighted: true },
      { isDivider: true },
      { label: 'Save', closeOnAction: false },
    ]
    const actionItem = items[0] as MenuActionItem
    const stickyItem = items[2] as MenuActionItem
    const submenuItem = {
      label: 'More',
      children: [] satisfies MenuItem[],
    }

    contextMenuState.current = {
      visible: true,
      items,
      x: 10,
      y: 20,
      slideFrom: 'top',
      ownerId,
      zIndex: 101,
    }

    expect(isOwnedContextMenuState(ownerId, contextMenuState.current)).toBe(true)
    expect(isOwnedContextMenuState(otherOwnerId, contextMenuState.current)).toBe(
      false
    )

    clearOwnedContextMenu(otherOwnerId)
    expect(contextMenuState.current?.ownerId).toBe(ownerId)

    highlightMenuItem(items, 'Save')
    expect(actionItem.isHighlighted).toBe(false)
    expect(stickyItem.isHighlighted).toBe(true)

    expect(shouldCloseMenuOnAction(actionItem)).toBe(true)
    expect(shouldCloseMenuOnAction(stickyItem)).toBe(false)
    expect(shouldCloseMenuOnAction(submenuItem)).toBe(false)

    clearOwnedContextMenu(ownerId)
    expect(contextMenuState.current).toBeNull()
  })
})
