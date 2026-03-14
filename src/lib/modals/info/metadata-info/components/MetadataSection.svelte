<script lang="ts">
  import type { Snippet } from 'svelte'
  import SectionHeader from '$lib/modals/shared/components/SectionHeader.svelte'

  const { title, children } = $props<{
    title: string
    children: Snippet
  }>()
</script>

<section class="section">
  <SectionHeader text={title} />
  <div class="content">
    {@render children()}
  </div>
</section>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
