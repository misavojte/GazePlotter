<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    children: Snippet
  }

  let { title, children }: Props = $props()
</script>

<div class="workspace-indicator" transition:fade={{ duration: 400 }}>
  <div class="indicator-card">
    <div class="indicator-header">
      <h3 class="indicator-title">{title}</h3>
    </div>
    <div class="indicator-body">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .workspace-indicator {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .indicator-card {
    max-width: 500px;
    width: 100%;
    box-sizing: border-box;
    background-color: var(--c-lightgrey);
    border-radius: var(--rounded-lg);
    border: 1px solid var(--c-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .indicator-header {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    background: var(--c-lightgrey);
  }

  .indicator-title {
    margin: 2px 0 2px 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--c-black);
  }

  .indicator-body {
    padding: 20px;
    background-color: var(--c-white);
  }

  @media (max-width: 600px) {
    .indicator-card {
      margin: 0 1rem;
    }
  }
</style>
