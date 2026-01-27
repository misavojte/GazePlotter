export type SlideFrom = 'top' | 'left'

export interface MenuItem {
  label: string
  value?: string
  action?: (data?: Record<string, any>) => void
  icon?: any
  isHighlighted?: boolean
  children?: MenuItem[]
  disabled?: boolean
  component?: any // Custom Svelte component
  componentProps?: Record<string, any>
  componentHeight?: number
}

export type Position = 'top' | 'bottom' | 'left' | 'right'
export type Alignment = 'start' | 'center' | 'end'

export interface ContextMenuOptions {
  items?: MenuItem[]
  content?: string
  anchor?: HTMLElement
  position?: Position
  verticalAlign?: Alignment
  horizontalAlign?: Alignment
  offset?: number
  slideFrom?: SlideFrom
  disabled?: boolean
  onOpen?: () => void
  onClose?: () => void
}

/**
 * Shape of the global context menu descriptor stored in Svelte state.
 *
 * @remarks
 * The `ownerId` allows multiple context menu anchors to coordinate access to
 * the single rendered menu instance so that an anchor can recognise whether it
 * currently "owns" the menu.
 */
export interface ContextMenuState {
  /** Whether the menu should be visible. */
  visible: boolean
  /** The menu entries rendered for actionable items. */
  items?: MenuItem[]
  /** Optional custom markup content. */
  content?: string
  /** Absolute X position in the viewport. */
  x: number
  /** Absolute Y position in the viewport. */
  y: number
  /** Direction the menu slides in from. */
  slideFrom: SlideFrom
  /** Symbol identifying which anchor currently controls the menu. */
  ownerId: symbol
  /** Z-index for the menu, automatically computed based on whether anchor is in a modal. */
  zIndex: number
}

export interface PlacementResult {
  left: number
  top: number
  isFlippedX: boolean
  isFlippedY: boolean
}
