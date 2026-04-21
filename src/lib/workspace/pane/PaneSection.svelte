<script lang="ts">
  import type { Snippet } from 'svelte'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'

  interface Props {
    title?: string
    children: Snippet
  }

  const { title, children }: Props = $props()

  // No title -> always open (expanded = true).
  // Has title -> default collapsed (expanded = false).
  let expanded = $state(title === undefined)
  let isCollapsible = $derived(title !== undefined)

  function toggle() {
    if (isCollapsible) expanded = !expanded
  }
</script>

<section class="pane-section">
  {#if title !== undefined}
    <button class="heading" aria-expanded={expanded} onclick={toggle}>
      <span class="icon" class:expanded>
        <ChevronDown size={14} strokeWidth={1.5} />
      </span>
      <span class="label">{title}</span>
    </button>
  {/if}

  <div class="body" class:no-heading={title === undefined} style:display={expanded ? 'flex' : 'none'}>
    {@render children()}
  </div>
</section>

<style>
  .pane-section {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Top divider — same visual language as the rail: 1px tall, inset by
     the section's horizontal padding on both sides so it lines up with
     the heading/body content instead of running edge-to-edge. */
  .pane-section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background-color: #e2e8f0;
  }

  /* Skip on the first section so it sits flush under the pane header. */
  .pane-section:first-of-type::before {
    content: none;
  }

  .heading {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px 8px;
    color: var(--c-darkgrey);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
    background: none;
    border: none;
    width: 100%;
    cursor: pointer;
    transition: color 0.15s;
  }

  .heading:hover,
  .heading:focus-visible {
    color: var(--c-black);
    outline: none;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Negative margin to pull icon flush with typical padding without
       shrinking the click target of the heading itself */
    margin-left: -4px;
    line-height: 0;
    transition: transform 0.2s ease;
    transform: rotate(-90deg); /* points right when collapsed */
  }

  .icon.expanded {
    transform: rotate(0deg); /* points down when expanded */
  }

  .label {
    line-height: 1;
    margin-top: 1px;
  }

  .body {
    padding: 4px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .body.no-heading {
    padding-top: 14px;
  }
</style>
