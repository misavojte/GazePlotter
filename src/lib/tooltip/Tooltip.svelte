<script lang="ts" module>
  import { tooltipState } from './tooltipState.svelte'
  import {
    TOOLTIP_JUMP_THRESHOLD,
    TOOLTIP_TRANSITION_DURATION,
    TOOLTIP_ANIMATION_DURATION,
  } from './const'

  import { cubicOut } from 'svelte/easing'

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
    position: fixed;
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
