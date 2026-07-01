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
  /* Soft pill — no border, fully rounded, sits as a quiet chip next to
     siblings inside a PaneEditRow. Reads as an action without competing
     visually with the section's primary picker above it. */
  .pane-edit-link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    background: var(--c-grey);
    border: none;
    border-radius: 999px;
    padding: 4px 12px;
    color: var(--c-black);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);
  }
  .pane-edit-link:hover {
    background: var(--c-midgrey);
    color: var(--c-brand);
  }
  .pane-edit-link:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--c-info) 45%, transparent);
    outline-offset: 1px;
  }
</style>
