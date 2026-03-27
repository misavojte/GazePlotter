<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Section } from '$lib/modals'

  const { title, children } = $props<{
    title: string
    children: Snippet
  }>()
</script>

<Section {title}>
  <div class="content">
    {@render children()}
  </div>
</Section>

<style>
  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
