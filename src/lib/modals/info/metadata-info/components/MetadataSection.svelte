<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Section } from '$lib/modals'

  interface Props {
    title: string
    children: Snippet
  }

  const { title, children }: Props = $props()
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
    gap: 8px;
  }
</style>
