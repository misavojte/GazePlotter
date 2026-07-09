<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    onclick: () => void
    children: Snippet
  }

  const { onclick, children }: Props = $props()
</script>

<button type="button" class="pane-edit-link" {onclick}>
  {@render children()}
</button>

<style>
  .pane-edit-link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    background: var(--c-grey);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    height: 26px;
    padding: 0 6px;
    color: var(--c-black);
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--transition-fast) ease,
      color var(--transition-fast) ease;
  }

  .pane-edit-link:hover {
    background: var(--c-midgrey);
    color: var(--c-brand);
  }

  .pane-edit-link:active {
    background: color-mix(in srgb, var(--c-black) 25%, transparent);
  }

  .pane-edit-link:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--c-info) 45%, transparent);
    outline-offset: 1px;
  }
</style>
