<script module lang="ts">
  import type { LucideIconComponent } from '$lib/shared/types'

  // Group item and props
  export interface MinorGroupItem {
    icon: LucideIconComponent
    onclick: (event: MouseEvent) => void
    isDisabled?: boolean
    ariaLabel?: string
    tooltip?: string
    isActive?: boolean
  }
</script>

<script lang="ts">
  import { tooltipAction } from '$lib/tooltip'

  // Single button props (backwards compatible with slot content)
  interface SingleProps {
    icon?: LucideIconComponent
    onclick?: (event: MouseEvent) => void
    isDisabled?: boolean
    isIcon?: boolean
    ariaLabel?: string
    tooltip?: string
    children?: import('svelte').Snippet
  }

  interface GroupProps {
    items?: MinorGroupItem[]
    compact?: boolean
    ariaLabel?: string
  }

  type Props = SingleProps & GroupProps

  let {
    // single
    icon,
    onclick = () => {},
    isDisabled = false,
    isIcon = true,
    ariaLabel,
    tooltip,
    children,
    // group
    items,
    compact = false,
  }: Props = $props()

  const itemsSafe = $derived((items ?? []) as MinorGroupItem[])
  const isGroup = $derived(itemsSafe.length > 0)

  // Press-feedback (scale-down on press, restore on release) is pure CSS
  // via `button:active .btnContent { transform: scale(0.92) }` — see the
  // stylesheet below. The 120 ms transition smooths very short clicks so
  // the dip is still perceptible without any JS event tracking.
</script>

{#if !isGroup}
  <!-- Single minor button (backwards compatible slot or icon prop) -->
  <button
    use:tooltipAction={{
      content: tooltip ?? '',
      position: 'top',
      offset: 35,
      verticalAlign: 'end',
      disabled: !tooltip,
    }}
    disabled={isDisabled}
    class:isIcon
    {onclick}
    aria-label={ariaLabel}
  >
    <span class="btnContent">
      {#if icon}
        <icon size={'1em'} strokeWidth={1}></icon>
      {/if}
      {@render children?.()}
    </span>
  </button>
{:else}
  <!-- Group mode: always icon-only buttons -->
  <div class="btnGroup" class:compact role="group" aria-label={ariaLabel}>
    {#each itemsSafe as item, idx}
      <div
        class="itemWrap"
        class:active={!!item.isActive}
        class:disabled={!!item.isDisabled}
        class:first={idx === 0}
        class:last={idx === itemsSafe.length - 1}
        use:tooltipAction={{
          content: item.tooltip ?? '',
          position: 'top',
          offset: 35,
          verticalAlign: 'end',
          disabled: !item.tooltip,
        }}
      >
        <button
          disabled={item.isDisabled}
          class:isIcon={true}
          onclick={item.onclick}
          aria-label={item.ariaLabel}
        >
          <span class="btnContent">
            <item.icon size={'1em'} strokeWidth={1} />
          </span>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  button {
    background: none;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    color: var(--c-black);
    padding: 0.25em 0.5em;
    text-align: center;
    text-decoration: none;
    align-items: center;
    justify-content: center;
    display: inline-flex;
    height: 34px;
    min-width: 34px;
    font-size: 15px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition:
      background-color var(--transition-fast) ease,
      color var(--transition-fast) ease;
  }
  button.isIcon {
    width: 34px;
  }
  button:hover {
    /* keep border unchanged to preserve seamless group look */
    color: var(--c-brand);
    background: var(--c-darkwhite);
  }
  button:disabled {
    cursor: not-allowed;
    color: var(--c-darkgrey);
    background: var(--c-lightgrey);
  }

  /* Group wrapper and separators */
  .btnGroup {
    display: inline-flex;
    gap: 0;
    background: inherit;
    border-radius: var(--rounded-md);
  }
  .btnGroup.compact :global(button) {
    height: 30px;
    min-width: 30px;
  }
  .itemWrap {
    position: relative;
  }
  .btnGroup .itemWrap:not(.first)::before {
    content: '';
    position: absolute;
    left: 0;
    top: 1px; /* avoid colliding with outer top border */
    bottom: 1px; /* avoid colliding with outer bottom border */
    width: 1px;
    background: var(--c-midgrey);
    opacity: 0.7;
    pointer-events: none;
    z-index: 2;
  }
  .btnGroup .itemWrap.disabled::before {
    opacity: 0.3;
  }
  .btnGroup .itemWrap:not(.first) :global(button) {
    border-left: none;
  }
  .btnGroup .itemWrap:not(.last) :global(button) {
    border-right: none;
  }
  .btnGroup .itemWrap :global(button) {
    border-radius: 0;
  }
  .btnGroup .itemWrap.first :global(button) {
    border-top-left-radius: var(--rounded-md);
    border-bottom-left-radius: var(--rounded-md);
  }
  .btnGroup .itemWrap.last :global(button) {
    border-top-right-radius: var(--rounded-md);
    border-bottom-right-radius: var(--rounded-md);
  }
  .itemWrap.active :global(button) {
    color: var(--c-brand);
    background: color-mix(in srgb, var(--c-info) 10%, transparent);
  }

  /* Content scaling feedback — pressed state via `:active` pseudoclass.
     The transition smooths instant clicks so the dip is still perceived. */
  .btnContent {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast) ease;
    will-change: transform;
  }
  button:active:not(:disabled) .btnContent {
    transform: scale(0.92);
  }
</style>

