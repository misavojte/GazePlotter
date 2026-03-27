<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    children: Snippet
  }

  let { title, children }: Props = $props()
</script>

<section class="modal-section">
  <div class="section-header">{title}</div>
  <div class="section-content">
    {@render children()}
  </div>
</section>

<style>
  .modal-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-header {
    font-weight: 600;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--c-border);
  }


</style>
