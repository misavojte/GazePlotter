<script lang="ts">
  import { tooltipStore } from '$lib/stores/tooltipStore'
  import { fade } from 'svelte/transition'
</script>

{#if $tooltipStore}
  <aside
    class="tooltip"
    transition:fade={{ duration: 200 }}
    style="left: {$tooltipStore.x}px; top: {$tooltipStore.y}px; width: {$tooltipStore.width}px;"
  >
    {#each $tooltipStore.content as item}
      <div class="tooltip-item">
        <div class="tooltip-item-title">{item.key}</div>
        <div class="tooltip-item-value">{item.value}</div>
      </div>
    {/each}
  </aside>
{/if}

<style>
  aside {
    position: absolute;
    font-size: 12px;
    background: #6d6d6d;
    color: rgba(255, 255, 255, 0.8);
    transition: 0.3s ease-in-out;
    border-radius: var(--rounded);
    z-index: 993;
  }
  .tooltip > div {
    padding: 5px;
  }
  .tooltip-item-value {
    border-bottom: none;
  }
  .tooltip-item-title {
    font-size: 70%;
    text-transform: uppercase;
  }
</style>
