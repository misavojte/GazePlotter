<script lang="ts">
  import type { Snippet } from 'svelte'

  /** The standard single-column field stack of modal forms — one field per
   *  row keeps configure steps scannable. */
  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()
</script>

<div class="field-grid">
  {@render children()}
</div>

<style>
  .field-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
</style>
