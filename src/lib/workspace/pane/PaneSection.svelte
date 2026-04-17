<script lang="ts">
  import type { Snippet } from 'svelte'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'

  interface Props {
    title: string
    children: Snippet
    /** Whether the section starts expanded. Defaults true. */
    defaultOpen?: boolean
    /** When true, the section cannot be collapsed. */
    alwaysOpen?: boolean
  }

  const { title, children, defaultOpen = true, alwaysOpen = false }: Props =
    $props()

  let open = $state(defaultOpen)
</script>

<section class="pane-section">
  <button
    type="button"
    class="heading"
    class:nonclickable={alwaysOpen}
    onclick={() => {
      if (!alwaysOpen) open = !open
    }}
    aria-expanded={alwaysOpen ? undefined : open}
  >
    {#if !alwaysOpen}
      {#if open}
        <ChevronDown size={12} />
      {:else}
        <ChevronRight size={12} />
      {/if}
    {/if}
    <span class="label">{title}</span>
  </button>

  {#if open || alwaysOpen}
    <div class="body">
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .pane-section {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--c-border, #e5e7eb);
  }

  .heading {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    padding: 10px 16px 8px;
    cursor: pointer;
    color: var(--c-darkgrey);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
  }
  .heading.nonclickable {
    cursor: default;
  }
  .heading:hover:not(.nonclickable) {
    color: var(--c-text);
  }

  .label {
    line-height: 1;
  }

  .body {
    padding: 4px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
