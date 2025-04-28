<script lang="ts" context="module">
  import { tooltipStore, updateTooltip } from '$lib/tooltip'

  /**
   * @description This is a tooltip action that is used to create a tooltip.
   * @param node - The node to attach the tooltip to.
   * @param options - The options for the tooltip.
   */
  export const tooltipAction = (
    node: HTMLElement,
    options: {
      content: string | { key: string; value: string }[]
      position?: 'top' | 'bottom' | 'left' | 'right'
      width?: number
      offset?: number
      horizontalAlign?: 'start' | 'center' | 'end'
      verticalAlign?: 'start' | 'center' | 'end'
    }
  ) => {
    let content: { key: string; value: string }[] = []

    // Convert string content to the expected format
    if (typeof options.content === 'string') {
      content = [{ key: '', value: options.content }]
    } else {
      content = options.content
    }

    const position = options.position || 'top'
    const width =
      options.width || Math.max(100, content[0]?.value.length * 8 || 100)
    const offset = options.offset || 10
    const horizontalAlign = options.horizontalAlign || 'start'
    const verticalAlign = options.verticalAlign || 'start'

    function showTooltip(event: MouseEvent) {
      const rect = node.getBoundingClientRect()
      let x: number, y: number

      // Calculate horizontal position based on alignment
      const calculateHorizontalPosition = (baseX: number): number => {
        switch (horizontalAlign) {
          case 'start':
            return baseX
          case 'center':
            return baseX + rect.width / 2 - width / 2
          case 'end':
            return baseX + rect.width - width
          default:
            return baseX
        }
      }

      // Calculate vertical position based on alignment
      const calculateVerticalPosition = (baseY: number): number => {
        switch (verticalAlign) {
          case 'start':
            return baseY
          case 'center':
            return baseY + rect.height / 2
          case 'end':
            return baseY + rect.height
          default:
            return baseY
        }
      }

      // Position tooltip based on specified position
      switch (position) {
        case 'top':
          x = calculateHorizontalPosition(rect.left)
          y = rect.top - offset + window.scrollY
          break
        case 'bottom':
          x = calculateHorizontalPosition(rect.left)
          y = rect.bottom + offset + window.scrollY
          break
        case 'left':
          x = rect.left - width - offset
          y = calculateVerticalPosition(rect.top) + window.scrollY
          break
        case 'right':
          x = rect.right + offset
          y = calculateVerticalPosition(rect.top) + window.scrollY
          break
        default:
          x = calculateHorizontalPosition(rect.left)
          y = rect.top - offset + window.scrollY
      }

      updateTooltip({
        visible: true,
        content,
        x,
        y,
        width,
      })
    }

    function hideTooltip() {
      updateTooltip(null)
    }

    // Add event listeners
    node.addEventListener('mouseenter', showTooltip)
    node.addEventListener('mouseleave', hideTooltip)

    // Clean up on unmount
    return {
      destroy() {
        node.removeEventListener('mouseenter', showTooltip)
        node.removeEventListener('mouseleave', hideTooltip)
        hideTooltip()
      },
    }
  }
</script>

<script lang="ts">
  import { fade } from 'svelte/transition'
  // No need to import tooltipStore again as it's already imported in the module context
</script>

{#if $tooltipStore}
  <aside
    class="tooltip"
    transition:fade={{ duration: 200 }}
    style="left: {$tooltipStore.x}px; top: {$tooltipStore.y}px; width: {$tooltipStore.width}px;"
  >
    {#each $tooltipStore.content as item}
      <div class="tooltip-item">
        <div class="tooltip-item-title">{item.key}</div>
        <div class="tooltip-item-value">{item.value}</div>
      </div>
    {/each}
  </aside>
{/if}

<style>
  aside {
    position: absolute;
    font-size: 12px;
    background: #6d6d6d;
    color: rgba(255, 255, 255, 0.8);
    transition: 0.3s ease-in-out;
    border-radius: var(--rounded);
    z-index: 993;
    pointer-events: none;
  }
  .tooltip > div {
    padding: 5px;
  }
  .tooltip-item-value {
    border-bottom: none;
  }
  .tooltip-item-title {
    font-size: 70%;
    text-transform: uppercase;
  }
</style>
