<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title?: string
    children: Snippet
  }

  let { title, children }: Props = $props()
</script>

<section class="modal-section">
  {#if title}
    <div class="section-header">{title}</div>
  {/if}
  <div class="section-content">
    {@render children()}
  </div>
</section>

<style>
  .modal-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .section-header {
    font-weight: 600;
  }
</style>
