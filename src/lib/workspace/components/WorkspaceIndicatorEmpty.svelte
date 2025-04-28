<script lang="ts">
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'
  import PanelButtonUpload from '$lib/workspace/panel/components/PanelButtonUpload.svelte'
  import PanelButtonDemo from '$lib/workspace/panel/components/PanelButtonDemo.svelte'
  import { processingFileStateStore } from '$lib/workspace'
  import { fade } from 'svelte/transition'

  const reloadViews = () => {
    processingFileStateStore.set('done')
  }
</script>

<div class="empty-workspace-indicator" transition:fade={{ duration: 400 }}>
  <div class="content">
    <div class="icon">
      <svg
        width="80"
        height="80"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 3v4a1 1 0 0 0 1 1h4"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M9 9h1M9 13h6M9 17h6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <h2>Your workspace is empty</h2>
    <p>
      Data is available in memory, but no visualizations are displayed. You can
      reload the views, upload new data, or explore our sample data.
    </p>
    <div class="actions">
      <GeneralButtonMajor onclick={reloadViews}>Reload Views</GeneralButtonMajor
      >
      <PanelButtonUpload />
      <PanelButtonDemo />
    </div>
  </div>
</div>

<style>
  .empty-workspace-indicator {
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

  .content {
    max-width: 500px;
    text-align: center;
    background-color: white;
    border-radius: 12px;
    padding: 2.5rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  }

  .icon {
    display: flex;
    justify-content: center;
    color: var(--c-primary);
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--c-text-dark);
  }

  p {
    margin: 0 0 1.5rem 0;
    color: var(--c-text);
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  @media (max-width: 600px) {
    .content {
      margin: 0 1rem;
      padding: 1.5rem;
    }
  }
</style>
