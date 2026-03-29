<script lang="ts" module>
  import {
    tooltipState,
    updateTooltip,
    estimateTooltipWidth,
  } from './tooltipState.svelte'
  import {
    TOOLTIP_JUMP_THRESHOLD,
    TOOLTIP_TRANSITION_DURATION,
    TOOLTIP_ANIMATION_DURATION,
    TOOLTIP_DEFAULT_OFFSET,
  } from './const'

  import { cubicOut } from 'svelte/easing'

  type Position = 'top' | 'bottom' | 'left' | 'right'
  type Alignment = 'start' | 'center' | 'end'

  interface TooltipOptions {
    content: string | { key: string; value: string }[]
    position?: Position
    width?: number
    offset?: number
    horizontalAlign?: Alignment
    verticalAlign?: Alignment
    disabled?: boolean
  }

  /**
   * Custom animation that decides whether to slide or snap based on distance.
   */
  export function tooltipMove(
    node: HTMLElement,
    { from, to }: { from: DOMRect; to: DOMRect }
  ) {
    const dx = from.left - to.left
    const dy = from.top - to.top
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Safety check: if distance is too large, don't animate even if ID matched
    if (distance > TOOLTIP_JUMP_THRESHOLD) return { duration: 0 }

    const style = getComputedStyle(node)
    const transform = style.transform === 'none' ? '' : style.transform

    return {
      duration: TOOLTIP_ANIMATION_DURATION,
      easing: cubicOut,
      tick: (t: number, u: number) => {
        node.style.transform = `${transform} translate(${u * dx}px, ${u * dy}px)`
      },
    }
  }

  /**
   * Simple portal action to move elements to a designated host or body.
   */
  export const portal = (
    node: HTMLElement,
    targetId: string = 'gp-tooltip-portal-host'
  ) => {
    const target = document.getElementById(targetId) || document.body
    target.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node)
      },
    }
  }

  const normalizeContent = (content: TooltipOptions['content']) =>
    typeof content === 'string' ? [{ key: '', value: content }] : content

  const calculateAlignedPosition = (
    base: number,
    size: number,
    targetSize: number,
    align: Alignment
  ): number => {
    const alignments = {
      start: base,
      center: base + size / 2 - targetSize / 2,
      end: base + size - targetSize,
    }
    return alignments[align]
  }

  const calculatePosition = (
    rect: DOMRect,
    position: Position,
    width: number,
    offset: number,
    hAlign: Alignment,
    vAlign: Alignment
  ): [number, number] => {
    // Tooltips are portaled to body (usually via gp-tooltip-portal-host), so we use page coordinates
    const scrollX = window.scrollX
    const scrollY = window.scrollY

    const positions: Record<Position, [number, number]> = {
      top: [
        calculateAlignedPosition(
          rect.left + scrollX,
          rect.width,
          width,
          hAlign
        ),
        rect.top + scrollY - offset,
      ],
      bottom: [
        calculateAlignedPosition(
          rect.left + scrollX,
          rect.width,
          width,
          hAlign
        ),
        rect.bottom + scrollY + offset,
      ],
      left: [
        rect.left + scrollX - width - offset,
        calculateAlignedPosition(rect.top + scrollY, rect.height, 20, vAlign), // 20 is a rough estimate for single line height
      ],
      right: [
        rect.right + scrollX + offset,
        calculateAlignedPosition(rect.top + scrollY, rect.height, 20, vAlign),
      ],
    }
    return positions[position]
  }

  export const tooltipAction = (node: HTMLElement, options: TooltipOptions) => {
    let isHovering = false
    const id = Math.random().toString(36).substring(2, 9)

    const getResolvedOptions = (opts: TooltipOptions) => {
      const content = normalizeContent(opts.content)
      return {
        id,
        content,
        position: opts.position ?? 'top',
        width: opts.width ?? estimateTooltipWidth(content),
        offset: opts.offset ?? TOOLTIP_DEFAULT_OFFSET,
        hAlign: opts.horizontalAlign ?? 'center',
        vAlign: opts.verticalAlign ?? 'center',
        disabled: opts.disabled ?? false,
      }
    }

    let state = getResolvedOptions(options)

    const show = () => {
      if (state.disabled) return
      isHovering = true
      const rect = node.getBoundingClientRect()
      const [x, y] = calculatePosition(
        rect,
        state.position,
        state.width,
        state.offset,
        state.hAlign,
        state.vAlign
      )
      updateTooltip({
        id: state.id,
        visible: true,
        content: state.content,
        x,
        y,
        width: state.width,
      })
    }

    const hide = () => {
      isHovering = false
      updateTooltip(null)
    }

    const hideImmediate = () => {
      isHovering = false
      updateTooltip(null, 0)
    }

    const refresh = () => {
      if (isHovering) {
        state.disabled ? hide() : show()
      }
    }

    node.addEventListener('mouseenter', show)
    node.addEventListener('mouseleave', hide)
    node.addEventListener('pointerdown', hideImmediate)

    return {
      update(newOptions: TooltipOptions) {
        state = getResolvedOptions(newOptions)
        refresh()
      },
      destroy() {
        node.removeEventListener('mouseenter', show)
        node.removeEventListener('mouseleave', hide)
        node.removeEventListener('pointerdown', hideImmediate)
        if (isHovering) hide()
      },
    }
  }
</script>

<script lang="ts">
  import { fade } from 'svelte/transition'
</script>

{#each tooltipState.current ? [tooltipState.current] : [] as current (current.id)}
  <aside
    class="tooltip"
    use:portal
    animate:tooltipMove
    transition:fade={{ duration: TOOLTIP_TRANSITION_DURATION }}
    style="left: {current.x}px; top: {current.y}px; width: {current.width}px;"
  >
    {#each current.content as item}
      <div class="tooltip-item">
        {#if item.key !== ''}
          <div class="tooltip-item-title">{item.key}</div>
        {/if}
        <div class="tooltip-item-value">{item.value}</div>
      </div>
    {/each}
  </aside>
{/each}

<style>
  aside {
    position: absolute;
    font-size: 11px;
    background: var(--c-darkgrey); /* Modern Slate palette */
    color: white;
    border-radius: 4px;
    z-index: 10000;
    pointer-events: none;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
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
