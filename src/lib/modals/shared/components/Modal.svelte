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
  import { fade, scale } from 'svelte/transition'

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
  let showScrollIndicator = $state(false)
  let showVersionMessage = $state(false)
  let bodyElement: HTMLElement | null = $state(null)

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement
  }

  function checkScrollable() {
    if (bodyElement) {
      const isScrollable = bodyElement.scrollHeight > bodyElement.clientHeight
      const isScrolledToBottom = bodyElement.scrollTop + bodyElement.clientHeight >= bodyElement.scrollHeight - 5
      
      if (isScrollable) {
        // If content is scrollable, show scroll indicator unless scrolled to bottom
        showScrollIndicator = !isScrolledToBottom
        showVersionMessage = isScrolledToBottom
      } else {
        // If content is not scrollable, show version message
        showScrollIndicator = false
        showVersionMessage = true
      }
    }
  }

  // Check when bodyElement becomes available
  $effect(() => {
    if (bodyElement) {
      checkScrollable()
    }
  })

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
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 150 }}
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
      in:scale={{ duration: 200, start: 0.8 }}
      out:scale={{ duration: 150, start: 0.8 }}
    >
      <div class="modal-header">
        <h3 id="modal-title">{modal.title}</h3>
        <button onclick={handleClose} aria-label="Close modal">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="body" bind:this={bodyElement} onscroll={checkScrollable}>
        <modal.component {...modal.props} />
      </div>
      <div class="modal-footer">
        {#if showScrollIndicator}
          <div class="footer-content" in:fade={{ duration: 200 }} out:fade={{ duration: 150 }}>
            <div class="scroll-indicator">↓</div>
            <span>Scroll down for more</span>
          </div>
        {:else if showVersionMessage}
          <div class="footer-content" in:fade={{ duration: 200 }} out:fade={{ duration: 150 }}>
            <span>GazePlotter {__APP_VERSION__} by Vojtechovska & Popelka, 2025</span>
          </div>
        {/if}
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
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1001;
    background-color: white;
    border-radius: 20px;
    min-width: 420px;
    font-size: 14px;
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 2rem);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  @media (min-width: 768px) {
    .modal {
      max-width: calc(100vw - 4rem);
      max-height: calc(100vh - 4rem);
    }
  }
  
  @media (min-width: 1024px) {
    .modal {
      max-width: calc(100vw - 6rem);
      max-height: calc(100vh - 6rem);
    }
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
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--c-midgrey);
    flex-wrap: wrap;
    gap: 0 20px;
    flex-shrink: 0;
  }
  .modal-header h3 {
    margin: 0;
  }
  .modal .body {
    padding: 1.25rem;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    min-height: 0;
  }
  
  .modal-footer {
    padding: 0.5rem 1.25rem;
    border-top: 1px solid var(--c-midgrey);
    background-color: white;
    font-size: 0.75rem;
    color: #bbb;
    text-align: left;
    flex-shrink: 0;
    position: relative;
    height: 2rem;
    display: flex;
    align-items: center;
  }
  
  .footer-content {
    position: absolute;
    left: 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .scroll-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #bbb;
    font-size: 0.6rem;
    animation: bounce 2s infinite;
  }
  
  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-3px);
    }
    60% {
      transform: translateY(-2px);
    }
  }
</style>
