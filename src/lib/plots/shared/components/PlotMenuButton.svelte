<script lang="ts">
  import type { MenuItem } from '$lib/context-menu'
  import ButtonMinor from '$lib/shared/components/ButtonMinor.svelte'
  import type { PlotMenuItem } from '../plotMenuActions'
  import { tooltipAction } from '$lib/tooltip'
  import { contextMenuAction } from '$lib/context-menu'

  interface Props {
    items: PlotMenuItem[]
  }

  let { items }: Props = $props()

  // Track open state only to disable tooltip while menu is open
  let isOpen = $state(false)
  let menuElement: HTMLDivElement | null = $state(null)

  const contextMenuItems = $derived(
    items.map((item): MenuItem => {
      if (item.isDivider) {
        return { isDivider: true }
      }

      return {
        label: item.label,
        onAction: item.onAction,
        icon: item.icon,
      }
    })
  )

  const handleClick = () => {
    if (!menuElement) return
    const rect = menuElement.getBoundingClientRect()
    const clientX = rect.right
    const clientY = rect.bottom
    // Dispatch synthetic contextmenu to trigger the shared context menu action
    const ev = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX,
      clientY,
    })
    menuElement.dispatchEvent(ev)
  }
</script>

<div
  class="wrap"
  bind:this={menuElement}
  use:tooltipAction={{
    content: 'Plot & data options',
    position: 'top',
    offset: 35,
    verticalAlign: 'end',
    disabled: isOpen,
  }}
  use:contextMenuAction={{
    items: contextMenuItems,
    position: 'bottom',
    verticalAlign: 'end',
    horizontalAlign: 'start',
    offset: 8,
    slideFrom: 'top',
    anchor: menuElement ?? undefined,
    onOpen: () => {
      isOpen = true
    },
    onClose: () => {
      isOpen = false
    },
  }}
>
  <ButtonMinor isIcon={false} onclick={handleClick}>
    <span class="triggerContent">
      <svg
        class="dots"
        width="10"
        height="16"
        viewBox="0 0 4 12"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="2" cy="2" r="0.8" />
        <circle cx="2" cy="6" r="0.8" />
        <circle cx="2" cy="10" r="0.8" />
      </svg>
      <span class="triggerLabel">More</span>
    </span>
  </ButtonMinor>
</div>

<style>
  .wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .triggerContent {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding-inline: 2px;
  }

  .triggerLabel {
    color: currentColor;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 500;
    letter-spacing: 0.02em;
    margin-top: 0;
  }

  .dots {
    display: block;
  }
</style>
