<script lang="ts">
  import type { Snippet } from 'svelte'

  const {
    padding = 'lg',
    class: className = '',
    gap = '0',
    children,
  }: {
    padding?: 'sm' | 'lg'
    class?: string
    gap?: string
    children: Snippet
  } = $props()
</script>

<div
  class="card {className}"
  class:padding-sm={padding === 'sm'}
  class:padding-lg={padding === 'lg'}
  style="gap: {gap}"
>
  {@render children()}
</div>

<style>
  .card {
    background: var(--c-lightgrey);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
  }

  .padding-sm {
    padding: 0.75rem;
  }

  .padding-lg {
    padding: 32px;
  }
</style>
