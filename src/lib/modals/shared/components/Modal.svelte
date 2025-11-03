<script module lang="ts">
  export type Modal = {
    component: typeof import('svelte').SvelteComponent
    title: string
    props?: Record<string, any>
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { fade, scale } from 'svelte/transition'

  let modal: Modal | null = $state(null)

  const unsubscribe = modalStore.subscribe(value => {
    modal = value as Modal | null
  })

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
  let modalElement: HTMLElement | null = $state(null)

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

  // Lock body scroll and preserve scroll position
  function lockBodyScroll() {
    // Store current scroll position
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    
    // Store original styles
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalTop = document.body.style.top
    const originalLeft = document.body.style.left
    const originalWidth = document.body.style.width
    const originalHeight = document.body.style.height
    
    // Lock body scroll at current position
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = `-${scrollX}px`
    document.body.style.width = '100%'
    document.body.style.height = '100%'
    
    return () => {
      // Restore original styles
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.top = originalTop
      document.body.style.left = originalLeft
      document.body.style.width = originalWidth
      document.body.style.height = originalHeight
      
      // Restore scroll position
      window.scrollTo(scrollX, scrollY)
    }
  }

  // Redirect window scroll events to modal content
  function handleWindowScroll(event: Event) {
    if (bodyElement && modal) {
      event.preventDefault()
      event.stopPropagation()
      
      // Convert wheel event to scroll the modal content
      if (event instanceof WheelEvent) {
        const deltaY = event.deltaY
        const scrollAmount = deltaY * 0.5 // Adjust sensitivity
        
        if (bodyElement.scrollHeight > bodyElement.clientHeight) {
          bodyElement.scrollTop += scrollAmount
        }
      }
    }
  }

  // Check when bodyElement becomes available
  $effect(() => {
    if (bodyElement) {
      checkScrollable()
    }
  })

  let unlockBodyScroll: (() => void) | null = null

  onMount(() => {
    // Add event listeners
    window.addEventListener('keydown', handleKeydown, { passive: true })
    document.addEventListener('fullscreenchange', handleFullscreenChange, { passive: true })
    
    // Lock body scroll when modal opens
    if (modal) {
      unlockBodyScroll = lockBodyScroll()
      // Add wheel event listener to redirect scroll to modal content
      window.addEventListener('wheel', handleWindowScroll, { passive: false })
    }

    return () => {
      // Remove event listeners on component destruction
      window.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('wheel', handleWindowScroll)
      
      // Unsubscribe from modal store
      unsubscribe()

      // Unlock body scroll
      if (unlockBodyScroll) {
        unlockBodyScroll()
      }
    }
  })

  // Handle modal state changes
  $effect(() => {
    if (modal && !unlockBodyScroll) {
      // Modal opened - lock body scroll
      unlockBodyScroll = lockBodyScroll()
      window.addEventListener('wheel', handleWindowScroll, { passive: false })
    } else if (!modal && unlockBodyScroll) {
      // Modal closed - unlock body scroll
      unlockBodyScroll()
      unlockBodyScroll = null
      window.removeEventListener('wheel', handleWindowScroll)
    }
  })
</script>

{#if modal}
  <div
    class="modal-overlay"
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
      bind:this={modalElement}
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
    /* Google-like border */
    border: 1px solid #dadce0;
    box-shadow: 
      0 1px 2px 0 rgba(60, 64, 67, 0.3),
      0 1px 3px 1px rgba(60, 64, 67, 0.15),
      0 0 0 1px rgba(60, 64, 67, 0.05);
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
