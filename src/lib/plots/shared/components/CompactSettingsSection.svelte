<script lang="ts">
  import type { Snippet } from 'svelte'

  const { title, children } = $props<{
    title: string
    children: Snippet
  }>()
</script>

<div class="section">
  <span class="section-title">{title}</span>
  <div class="section-content">
    {@render children()}
  </div>
</div>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
    display: block;
  }

  .section-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
