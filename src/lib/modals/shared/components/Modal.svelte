<script lang="ts">
  import { onMount, tick } from 'svelte'
  import ButtonMajor from '$lib/shared/components/ButtonMajor.svelte'
  import type { ModalStackEntry } from '$lib/modals/modalState.svelte'
  import { getGazePlotterSession } from '$lib/session'

  const { errorService, modalState } = getGazePlotterSession()

  const modalStack = $derived(modalState.stack)
  const activeModal = $derived(modalState.activeModal)

  const handleClose = () => {
    modalState.close()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && activeModal) {
      handleClose()
    }
  }

  let isFullscreen = false
  let showScrollIndicator = $state(false)
  let showVersionMessage = $state(false)
  let activeBodyElement: HTMLElement | null = $state(null)

  function getModalComponentName(component: unknown): string | null {
    if (
      typeof component === 'function' &&
      'name' in component &&
      typeof component.name === 'string' &&
      component.name.trim().length > 0
    ) {
      return component.name
    }

    return null
  }

  function getModalErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error
    }

    return 'Unknown dialog error'
  }

  function reportModalRenderError(
    entry: ModalStackEntry,
    error: unknown
  ): void {
    errorService.report({
      origin: 'modal',
      severity: 'recoverable',
      userMessage: `Could not display the "${entry.definition.title}" dialog.`,
      cause: error,
      context: {
        modalTitle: entry.definition.title,
        modalComponent: getModalComponentName(entry.definition.component),
        hasProps: Object.keys(entry.props).length > 0,
      },
    })
  }

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement
  }

  function updateActiveBodyElement() {
    activeBodyElement = document.querySelector(
      '.modal-stack-entry.is-active .body'
    ) as HTMLElement | null

    if (activeBodyElement) {
      checkScrollable()
      return
    }

    showScrollIndicator = false
    showVersionMessage = false
  }

  function checkScrollable() {
    if (activeBodyElement) {
      const isScrollable =
        activeBodyElement.scrollHeight > activeBodyElement.clientHeight
      const isScrolledToBottom =
        activeBodyElement.scrollTop + activeBodyElement.clientHeight >=
        activeBodyElement.scrollHeight - 5

      if (isScrollable) {
        showScrollIndicator = !isScrolledToBottom
        showVersionMessage = isScrolledToBottom
      } else {
        showScrollIndicator = false
        showVersionMessage = true
      }

      return
    }

    showScrollIndicator = false
    showVersionMessage = false
  }

  function lockBodyScroll() {
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalTop = document.body.style.top
    const originalLeft = document.body.style.left
    const originalWidth = document.body.style.width
    const originalHeight = document.body.style.height

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = `-${scrollX}px`
    document.body.style.width = '100%'
    document.body.style.height = '100%'

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.top = originalTop
      document.body.style.left = originalLeft
      document.body.style.width = originalWidth
      document.body.style.height = originalHeight

      window.scrollTo(scrollX, scrollY)
    }
  }

  function handleWindowScroll(event: Event) {
    if (activeBodyElement && activeModal) {
      // Allow nested scrollable elements to handle their own scrolling
      const path = event.composedPath()
      for (let i = 0; i < path.length; i++) {
        const target = path[i] as HTMLElement
        if (target === activeBodyElement) break

        if (target && target.scrollHeight > target.clientHeight) {
          const overflowY = window.getComputedStyle(target).overflowY
          if (overflowY === 'auto' || overflowY === 'scroll') {
            return // Let the nested element scroll natively
          }
        }
      }

      event.preventDefault()
      event.stopPropagation()

      if (event instanceof WheelEvent) {
        const scrollAmount = event.deltaY * 0.5

        if (activeBodyElement.scrollHeight > activeBodyElement.clientHeight) {
          activeBodyElement.scrollTop += scrollAmount
        }
      }
    }
  }

  $effect(() => {
    const activeModalId = activeModal?.id ?? null

    void tick().then(() => {
      if (activeModalId !== (activeModal?.id ?? null)) return
      updateActiveBodyElement()
    })
  })

  let unlockBodyScroll: (() => void) | null = null

  onMount(() => {
    window.addEventListener('keydown', handleKeydown, { passive: true })
    document.addEventListener('fullscreenchange', handleFullscreenChange, {
      passive: true,
    })

    if (modalStack.length > 0) {
      unlockBodyScroll = lockBodyScroll()
      window.addEventListener('wheel', handleWindowScroll, { passive: false })
    }

    return () => {
      window.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('wheel', handleWindowScroll)

      if (unlockBodyScroll) {
        unlockBodyScroll()
      }
    }
  })

  $effect(() => {
    if (modalStack.length > 0 && !unlockBodyScroll) {
      unlockBodyScroll = lockBodyScroll()
      window.addEventListener('wheel', handleWindowScroll, { passive: false })
      return
    }

    if (modalStack.length === 0 && unlockBodyScroll) {
      unlockBodyScroll()
      unlockBodyScroll = null
      activeBodyElement = null
      showScrollIndicator = false
      showVersionMessage = false
      window.removeEventListener('wheel', handleWindowScroll)
    }
  })
</script>

{#if modalStack.length > 0}
  <div
    class="modal-overlay"
    onpointerdown={e => {
      if (e.target === e.currentTarget && !isFullscreen) {
        handleClose()
      }
    }}
  >
    {#each modalStack as entry (entry.id)}
      {@const isActive = entry.id === activeModal?.id}
      <div class:is-active={isActive} class="modal-stack-entry">
        <div
          class="modal"
          role="dialog"
          aria-modal={isActive}
          aria-hidden={!isActive}
          aria-labelledby={`modal-title-${entry.id}`}
        >
          <div class="modal-header">
            <h3 id={`modal-title-${entry.id}`}>{entry.definition.title}</h3>
            <button onclick={handleClose} aria-label="Close modal">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="body" onscroll={checkScrollable}>
            <svelte:boundary onerror={error => reportModalRenderError(entry, error)}>
              <entry.definition.component {...entry.props} />

              {#snippet failed(error, reset)}
                <div class="modal-error-state">
                  <p class="modal-error-copy">
                    This dialog could not be displayed. You can retry it or
                    close the window.
                  </p>
                  <p class="modal-error-detail">{getModalErrorMessage(error)}</p>
                  <ButtonMajor
                    onclick={() => reset()}
                    size="sm"
                    variant="secondary"
                  >
                    Retry dialog
                  </ButtonMajor>
                </div>
              {/snippet}
            </svelte:boundary>
          </div>
          <div class="modal-footer">
            {#if isActive && showScrollIndicator}
              <div class="footer-content">
                <div class="scroll-indicator">&#8595;</div>
                <span>Scroll down for more</span>
              </div>
            {:else if isActive && showVersionMessage}
              <div class="footer-content">
                <span
                  >GazePlotter {__APP_VERSION__} by Vojtechovska & Popelka,
                  2025</span
                >
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
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

  .modal-stack-entry {
    display: none;
  }

  .modal-stack-entry.is-active {
    display: block;
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
    border: 1px solid var(--c-border);
    box-shadow: var(--shadow-xl);
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

  .modal-error-state {
    min-height: 220px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .modal-error-copy,
  .modal-error-detail {
    margin: 0;
    color: var(--c-text);
    line-height: 1.45;
    font-size: 0.95rem;
  }

  .modal-error-detail {
    color: var(--c-midgrey);
    overflow-wrap: anywhere;
  }

  .modal-footer {
    padding: 0.5rem 1.25rem;
    border-top: 1px solid var(--c-midgrey);
    background-color: white;
    font-size: 0.75rem;
    color: var(--c-darkgrey);
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
    color: var(--c-darkgrey);
    font-size: 0.6rem;
    animation: bounce 2s infinite;
  }

  @keyframes bounce {
    0%,
    20%,
    50%,
    80%,
    100% {
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
