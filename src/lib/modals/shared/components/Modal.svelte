<script module lang="ts">
  export type Modal = {
    component: typeof import('svelte').SvelteComponent
    title: string
    props?: Record<string, any>
  }
</script>

<script lang="ts">
  import { onDestroy, onMount, type SvelteComponent } from 'svelte'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { fly } from 'svelte/transition'

  let modal: Modal | null = $state(null)

  const unsubscribe = modalStore.subscribe(value => {
    modal = value as Modal | null
  })

  onDestroy(unsubscribe)

  const handleClose = () => {
    modalStore.close()
  }

  // Add keyboard event handler for Escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && modal) {
      handleClose()
    }
  }

  // Track fullscreen state to prevent accidental closing
  let isFullscreen = false

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement
  }

  onMount(() => {
    // Add event listeners
    window.addEventListener('keydown', handleKeydown)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      // Remove event listeners on component destruction
      window.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  })
</script>

{#if modal}
  <div
    class="modal-overlay"
    aria-hidden="true"
    in:fly
    onpointerdown={e => {
      // Close only if clicking the overlay, not when in fullscreen
      if (e.target === e.currentTarget && !isFullscreen) {
        handleClose()
      }
    }}
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div class="modal-header">
        <h3 id="modal-title">{modal.title}</h3>
        <button onclick={handleClose} aria-label="Close modal">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="body">
        <modal.component {...modal.props} />
      </div>
    </div>
  </div>
{/if}

<style>
  /* Material UI like modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
  }
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1001;
    background-color: white;
    border-radius: var(--rounded-md);
    min-width: 420px;
    font-size: 14px;
  }
  button {
    border: none;
    background-color: transparent;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.25rem;
    margin-right: -0.25rem;
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  button:hover {
    background-color: var(--c-lightgrey);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--c-midgrey);
    flex-wrap: wrap;
    gap: 0 20px;
  }
  .modal-header h3 {
    margin: 0;
  }
  .modal .body {
    padding: 1rem;
    max-height: calc(100vh - 200px);
    overflow: auto;
  }
</style>
