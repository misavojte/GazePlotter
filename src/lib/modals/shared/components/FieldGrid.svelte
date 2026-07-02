<script lang="ts">
  import type { Snippet } from 'svelte'

  /** The standard responsive two-column field grid of modal forms. */
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
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 500px) {
    .field-grid {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }
</style>
