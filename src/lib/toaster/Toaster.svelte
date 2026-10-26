<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly } from 'svelte/transition'
  import type { ToastFillingType } from './types'
  import { getGazePlotterSession } from '$lib/session'
  import X from 'lucide-svelte/icons/x'

  const { toastState } = getGazePlotterSession()

  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  // Hover or focus pauses a toast: what is left of its time, and since when it ran.
  const remaining = new Map<number, number>()
  const startedAt = new Map<number, number>()
  const paused = new Set<number>()

  const clearTimer = (id: number) => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  const schedule = (id: number, ms: number) => {
    remaining.set(id, ms)
    startedAt.set(id, Date.now())
    timers.set(
      id,
      setTimeout(() => {
        toastState.remove(id)
        timers.delete(id)
      }, ms)
    )
  }

  const setRemovalTimer = (toast: ToastFillingType) => {
    if (!toast.duration || timers.has(toast.id) || paused.has(toast.id)) return
    if (remaining.has(toast.id)) return
    schedule(toast.id, toast.duration)
  }

  const pause = (id: number) => {
    if (!timers.has(id)) return
    clearTimer(id)
    paused.add(id)
    remaining.set(id, (remaining.get(id) ?? 0) - (Date.now() - (startedAt.get(id) ?? 0)))
  }

  const resume = (id: number) => {
    if (!paused.delete(id)) return
    schedule(id, Math.max(remaining.get(id) ?? 0, 1000))
  }

  // Manage timers reactively: add new ones, prune old ones
  $effect(() => {
    const currentToastIds = new Set(toastState.current.map(t => t.id))

    // Prune timers for toasts that are gone
    for (const id of remaining.keys()) {
      if (!currentToastIds.has(id)) {
        clearTimer(id)
        remaining.delete(id)
        startedAt.delete(id)
        paused.delete(id)
      }
    }

    // Set timers for new toasts
    toastState.current.forEach(setRemovalTimer)
  })

  $effect(() => {
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  })

  const handleManualClose = (id: number) => {
    clearTimer(id)
    toastState.remove(id)
  }
</script>

<div class="toaster" role="status" aria-live="polite">
  {#each toastState.current as { id, type, message, link, action, duration } (id)}
    <div
      class="toast toast-{type}"
      role="presentation"
      onmouseenter={() => pause(id)}
      onmouseleave={() => resume(id)}
      onfocusin={() => pause(id)}
      onfocusout={() => resume(id)}
      animate:flip={{ duration: 500 }}
      in:fly={{ duration: 300, x: 20 }}
      out:fly={{ duration: 300, x: 20 }}
    >
      <!-- Column 1: Content -->
      <div class="toast-content-col">
        <div class="toast-message">{message}</div>
        {#if link}
          <a
            class="toast-link"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </a>
        {/if}
        {#if action && (action.isAvailable?.() ?? true)}
          <button
            type="button"
            class="toast-action"
            onclick={() => {
              action.onAction()
              handleManualClose(id)
            }}
          >
            {action.label}
          </button>
        {/if}
      </div>

      <!-- Column 2: Actions -->
      <div class="toast-action-col">
        <button
          type="button"
          class="close-btn"
          aria-label="Dismiss notification"
          onclick={() => handleManualClose(id)}
        >
          {#if duration}
            <span class="progress-fill" style="animation-duration: {duration}ms"></span>
          {/if}
          <span class="close-icon"><X size={12} /></span>
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    /* A host with chrome along the bottom edge lifts toasts above it. */
    bottom: var(--gp-toaster-bottom, 8px);
    right: 8px;
    z-index: 9999;
    width: 280px;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .toast {
    pointer-events: auto;
    border-radius: var(--rounded-md);
    box-shadow: var(--shadow-lg);
    color: var(--c-white);
    margin-top: 8px;
    width: 280px;
    font-size: var(--text-lg);
    padding: 12px 16px;
    border: 1px solid var(--c-border);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--spacing-sm);
    align-items: start;
    box-sizing: border-box;
  }

  /* Status tokens are AA-dark already, so white text sits on them as is. */
  .toast-success {
    background-color: var(--c-success);
    border-color: color-mix(in srgb, var(--c-success) 40%, transparent);
  }

  .toast-error {
    background-color: var(--c-error);
    border-color: color-mix(in srgb, var(--c-error) 40%, transparent);
  }

  .toast-warning {
    background-color: var(--c-warning);
    border-color: color-mix(in srgb, var(--c-warning) 40%, transparent);
  }

  .toast-info {
    background-color: var(--c-info);
    border-color: color-mix(in srgb, var(--c-info) 40%, transparent);
  }

  .toast-content-col {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xxs);
    min-width: 0;
    min-height: 24px;
    justify-content: center;
  }

  .toast-message {
    line-height: var(--leading-normal);
    word-break: break-word;
    color: var(--c-white);
  }

  .toast-action-col {
    display: flex;
    align-items: start;
    flex-shrink: 0;
    height: 24px;
  }

  button.close-btn {
    position: relative;
    border: 1px solid color-mix(in srgb, var(--c-white) 15%, transparent);
    background-color: transparent;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    color: var(--c-white);
    box-sizing: border-box;
    transition: border-color var(--transition-normal), background-color var(--transition-normal);
    overflow: hidden;
  }
  button.close-btn:hover {
    border-color: color-mix(in srgb, var(--c-white) 40%, transparent);
    background-color: color-mix(in srgb, var(--c-white) 5%, transparent);
  }

  /* Owned wrapper keeps the icon above the progress fill without a
     :global() reach into the icon component's svg. */
  .close-icon {
    position: relative;
    z-index: 2;
    display: flex;
  }

  .progress-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0%;
    background-color: color-mix(in srgb, var(--c-white) 18%, transparent);
    animation: rise-fill linear forwards;
    pointer-events: none;
    z-index: 1;
  }

  .toast:hover .progress-fill,
  .toast:focus-within .progress-fill {
    animation-play-state: paused;
  }

  @keyframes rise-fill {
    from {
      height: 0%;
    }
    to {
      height: 100%;
    }
  }

  /* A verb, not a destination: underlined like the link, without its arrow. */
  .toast-action {
    align-self: flex-start;
    margin-top: 6px;
    padding: 0;
    border: none;
    background: none;
    color: var(--c-white);
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .toast-action:focus-visible {
    outline: 2px solid var(--c-white);
    outline-offset: 2px;
  }

  .toast-link {
    display: inline-block;
    margin-top: 6px;
    font-weight: 600;
    color: var(--c-white);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .toast-link::after {
    content: "→";
    margin-left: 4px;
    transition: transform var(--transition-fast) ease-in-out;
    display: inline-block;
  }
  .toast-link:hover,
  .toast-link:focus {
    color: var(--c-white);
    text-decoration: underline;
  }
  .toast-link:hover::after,
  .toast-link:focus::after {
    transform: translateX(3px);
  }
</style>
