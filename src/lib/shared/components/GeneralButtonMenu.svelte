<script lang="ts">
  import MinorButton from './GeneralButtonMinor.svelte'
  import { type ComponentType } from 'svelte'
  import { tooltipAction } from '$lib/tooltip/components/Tooltip.svelte'
  import { contextMenuAction } from '$lib/context-menu/components/contextMenuAction'

  interface ActionItem {
    icon: ComponentType
    label: string
    action: () => void
  }

  interface Props {
    items: ActionItem[]
  }

  let { items }: Props = $props()

  // Track open state only to disable tooltip while menu is open
  let isOpen = $state(false)
  let menuElement: HTMLDivElement | null = $state(null)

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
  use:tooltipAction={{ content: "Plot & data options", position: "top", offset: 35, verticalAlign: "end", disabled: isOpen}}
  use:contextMenuAction={{
    items: items.map((it) => ({ label: it.label, action: it.action, icon: it.icon as any })),
    position: 'bottom',
    verticalAlign: 'end',
    horizontalAlign: 'start',
    offset: 8,
    slideFrom: 'top',
    anchor: menuElement as HTMLElement,
    onOpen: () => { isOpen = true },
    onClose: () => { isOpen = false },
  }}
>
  <MinorButton isIcon={false} onclick={handleClick}>
    <span class="triggerContent">
      <svg class="dots" width="8" height="14" viewBox="0 0 4 12" fill="currentColor" aria-hidden="true">
        <circle cx="2" cy="2" r="0.8" />
        <circle cx="2" cy="6" r="0.8" />
        <circle cx="2" cy="10" r="0.8" />
      </svg>
      <span class="triggerLabel">More</span>
    </span>
  </MinorButton>
</div>

<style>
  .wrap {
    position: relative;
    display: flex;
  }
  
  .triggerContent {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  
  .triggerLabel {
    color: currentColor;
    font-size: 13px;
    line-height: 1;
    margin-top: 1px;
  }
</style>
