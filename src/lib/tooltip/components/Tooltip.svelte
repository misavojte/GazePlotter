<script lang="ts" module>
  import { estimateTextWidth } from '$lib/shared/utils/textUtils'
  import { tooltipStore, updateTooltip } from '$lib/tooltip'

  type Position = 'top' | 'bottom' | 'left' | 'right'
  type Alignment = 'start' | 'center' | 'end'

  interface TooltipOptions {
    content: string | { key: string; value: string }[]
    position?: Position
    width?: number
    offset?: number
    horizontalAlign?: Alignment
    verticalAlign?: Alignment
    hideOnClick?: boolean
    clickCooldown?: number
  }

  /**
   * Normalizes content to the expected array format.
   * Converts string content into a single-item array with empty key.
   */
  const normalizeContent = (content: TooltipOptions['content']) =>
    typeof content === 'string' ? [{ key: '', value: content }] : content

  /**
   * Calculates aligned position along an axis.
   * Used for both horizontal and vertical alignment calculations.
   */
  const calculateAlignedPosition = (
    base: number,
    size: number,
    targetSize: number,
    align: Alignment
  ): number => {
    const alignments = { start: base, center: base + size / 2 - targetSize / 2, end: base + size - targetSize }
    return alignments[align]
  }

  /**
   * Calculates tooltip position based on position type and alignment preferences.
   * Returns [x, y] coordinates for the tooltip.
   */
  const calculatePosition = (
    rect: DOMRect,
    position: Position,
    width: number,
    offset: number,
    hAlign: Alignment,
    vAlign: Alignment
  ): [number, number] => {
    const scrollY = window.scrollY
    const positions: Record<Position, [number, number]> = {
      top: [calculateAlignedPosition(rect.left, rect.width, width, hAlign), rect.top - offset + scrollY],
      bottom: [calculateAlignedPosition(rect.left, rect.width, width, hAlign), rect.bottom + offset + scrollY],
      left: [rect.left - width - offset, calculateAlignedPosition(rect.top, rect.height, 0, vAlign) + scrollY],
      right: [rect.right + offset, calculateAlignedPosition(rect.top, rect.height, 0, vAlign) + scrollY],
    }
    return positions[position]
  }

  /**
   * Tooltip action for displaying contextual information on hover.
   * @param node - The HTML element to attach the tooltip to
   * @param options - Configuration for tooltip appearance and behavior
   * @returns Action object with update and destroy lifecycle methods
   */
  export const tooltipAction = (node: HTMLElement, options: TooltipOptions) => {
    const content = normalizeContent(options.content)
    const textLineWithMostCharacters = content.map(item => item.value).sort((a, b) => b.length - a.length)[0]
    let state = {
      content,
      position: options.position ?? 'top',
      width: options.width ?? Math.min(125, estimateTextWidth(textLineWithMostCharacters, 12)) + 14,
      offset: options.offset ?? 10,
      hAlign: options.horizontalAlign ?? 'start',
      vAlign: options.verticalAlign ?? 'start',
      isHovering: false,
      hideOnClick: options.hideOnClick ?? true,
      clickCooldown: options.clickCooldown ?? 2000, // 2 seconds default
      isInCooldown: false,
    }

    /** Updates internal state from new options */
    const updateState = (opts: TooltipOptions) => {
      const content = normalizeContent(opts.content)
      const textLineWithMostCharacters = content.map(item => item.value).sort((a, b) => b.length - a.length)[0]
      state = {
        content,
        position: opts.position ?? 'top',
        width: opts.width ?? Math.min(125, estimateTextWidth(textLineWithMostCharacters, 12)) + 14,
        offset: opts.offset ?? 10,
        hAlign: opts.horizontalAlign ?? 'start',
        vAlign: opts.verticalAlign ?? 'start',
        isHovering: state.isHovering,
        hideOnClick: opts.hideOnClick ?? true,
        clickCooldown: opts.clickCooldown ?? 2000,
        isInCooldown: state.isInCooldown,
      }
    }

    /** Shows and positions the tooltip */
    const show = () => {
      if (state.isInCooldown) return
      state.isHovering = true
      const rect = node.getBoundingClientRect()
      const [x, y] = calculatePosition(rect, state.position, state.width, state.offset, state.hAlign, state.vAlign)
      updateTooltip({ visible: true, content: state.content, x, y, width: state.width })
    }

    /** Hides the tooltip */
    const hide = () => {
      state.isHovering = false
      updateTooltip(null)
    }

    /** Handles click events to hide tooltip and start cooldown */
    const handleClick = () => {
      if (state.hideOnClick) {
        // Hide immediately
        state.isHovering = false
        updateTooltip(null)
        // Start cooldown to prevent immediate re-showing
        state.isInCooldown = true
        setTimeout(() => {
          state.isInCooldown = false
        }, state.clickCooldown)
      }
    }

    /** Refreshes tooltip if currently visible */
    const refresh = () => state.isHovering && show()

    node.addEventListener('mouseenter', show)
    node.addEventListener('mouseleave', hide)
    node.addEventListener('click', handleClick)

    return {
      /** Updates tooltip when options change, refreshing if currently visible */
      update(newOptions: TooltipOptions) {
        updateState(newOptions)
        refresh()
      },
      /** Cleans up event listeners and hides tooltip on destroy */
      destroy() {
        node.removeEventListener('mouseenter', show)
        node.removeEventListener('mouseleave', hide)
        node.removeEventListener('click', handleClick)
        hide()
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
        {#if item.key !== ''}
          <div class="tooltip-item-title">{item.key}</div>
        {/if}
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
    transition: left 0.2s ease-in-out, top 0.2s ease-in-out;
    border-radius: var(--rounded);
    z-index: 993;
    pointer-events: none;
  }
  .tooltip > div {
    padding: 5px 7px;
  }
  .tooltip-item-value {
    border-bottom: none;
  }
  .tooltip-item-title {
    font-size: 70%;
    text-transform: uppercase;
  }
</style>
