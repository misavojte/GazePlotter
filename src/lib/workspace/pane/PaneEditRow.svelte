<script lang="ts">
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()
</script>

<div class="pane-edit-row">{@render children()}</div>

<style>
  .pane-edit-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-top: 2px;
  }
</style>
