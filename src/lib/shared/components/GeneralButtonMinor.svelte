<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { tooltipAction } from '$lib/tooltip/components/Tooltip.svelte'

  // Single button props (backwards compatible with slot content)
  interface SingleProps {
    icon?: ComponentType
    onclick?: (event: MouseEvent) => void
    isDisabled?: boolean
    isIcon?: boolean
    ariaLabel?: string
    tooltip?: string
    children?: import('svelte').Snippet
  }

  // Group item and props
  export interface MinorGroupItem {
    icon: ComponentType
    onclick: (event: MouseEvent) => void
    isDisabled?: boolean
    ariaLabel?: string
    tooltip?: string
    isActive?: boolean
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

  /**
   * Triggers a brief scale animation on the immediate content of a button
   * to provide tactile feedback on clicks.
   */
  function animateClickFeedback(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement | null
    if (!button) return
    const content = button.querySelector('.btnContent') as HTMLElement | null
    if (!content) return
    // Scale down then restore
    content.style.transform = 'scale(0.92)'
    const restore = () => {
      content.style.transform = 'scale(1)'
    }
    // Restore after short delay; also on mouseup/mouseleave just in case
    setTimeout(restore, 120)
  }

  /** Wrap a click handler to include the click feedback animation. */
  function withFeedback(handler: (event: MouseEvent) => void) {
    return (event: MouseEvent) => {
      animateClickFeedback(event)
      handler?.(event)
    }
  }
</script>

{#if !isGroup}
  <!-- Single minor button (backwards compatible slot or icon prop) -->
  <button
    use:tooltipAction={{ content: tooltip ?? '', position: 'top', offset: 35, verticalAlign: 'end', disabled: !tooltip }}
    disabled={isDisabled}
    class:isIcon={isIcon}
    onclick={withFeedback(onclick)}
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
  <div class="btnGroup" class:compact={compact} role="group" aria-label={ariaLabel}>
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
          disabled: !item.tooltip
        }}
      >
        <button
          disabled={item.isDisabled}
          class:isIcon={true}
          onclick={withFeedback(item.onclick)}
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
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    color: var(--c-black);
    padding: 0.25em 0.5em;
    text-align: center;
    text-decoration: none;
    align-items: center;
    justify-content: center;
    display: inline-flex;
    height: 34px;
    min-width: 34px;
    font-size: 16px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: background-color 120ms ease, color 120ms ease;
  }
  button.isIcon {
    width: 34px;
  }
  button:hover {
    /* keep border unchanged to preserve seamless group look */
    color: var(--c-brand);
    background: #f6f7f9;
  }
  button:disabled {
    cursor: not-allowed;
    color: var(--c-darkgrey);
    background: #eeeeee;
  }

  /* Group wrapper and separators */
  .btnGroup {
    display: inline-flex;
    gap: 0;
    background: inherit;
    border-radius: var(--rounded);
  }
  .btnGroup.compact :global(button) {
    height: 30px;
    min-width: 30px;
  }
  .itemWrap { position: relative; }
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
  .btnGroup .itemWrap.disabled::before { opacity: 0.3; }
  .btnGroup .itemWrap:not(.first) :global(button) { border-left: none; }
  .btnGroup .itemWrap:not(.last) :global(button) { border-right: none; }
  .btnGroup .itemWrap :global(button) { border-radius: 0; }
  .btnGroup .itemWrap.first :global(button) {
    border-top-left-radius: var(--rounded);
    border-bottom-left-radius: var(--rounded);
  }
  .btnGroup .itemWrap.last :global(button) {
    border-top-right-radius: var(--rounded);
    border-bottom-right-radius: var(--rounded);
  }
  .itemWrap.active :global(button) { color: var(--c-brand); background: #e9f2ff; }

  /* Content scaling feedback */
  .btnContent {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 120ms ease;
    will-change: transform;
  }
</style>
