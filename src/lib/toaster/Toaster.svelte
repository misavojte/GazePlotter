<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly } from 'svelte/transition'
  import type { ToastFillingType } from './types'
  import { getGazePlotterSession } from '$lib/session'
  import X from 'lucide-svelte/icons/x'

  const { toastState } = getGazePlotterSession()

  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  const clearTimer = (id: number) => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  const setRemovalTimer = (toast: ToastFillingType) => {
    if (!toast.duration || timers.has(toast.id)) return
    const timer = setTimeout(() => {
      toastState.remove(toast.id)
      timers.delete(toast.id)
    }, toast.duration)
    timers.set(toast.id, timer)
  }

  // Manage timers reactively: add new ones, prune old ones
  $effect(() => {
    const currentToastIds = new Set(toastState.current.map(t => t.id))

    // Prune timers for toasts that are gone
    for (const id of timers.keys()) {
      if (!currentToastIds.has(id)) {
        clearTimer(id)
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

<div class="toaster">
  {#each toastState.current as { id, type, message, link, duration } (id)}
    <div
      class="toast toast-{type}"
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
      </div>

      <!-- Column 2: Actions -->
      <div class="toast-action-col">
        <button
          type="button"
          class="close-btn"
          aria-label="Close"
          onclick={() => handleManualClose(id)}
        >
          {#if duration}
            <span class="progress-fill" style="animation-duration: {duration}ms"></span>
          {/if}
          <X size={12} />
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    bottom: 20px;
    right: 20px;
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
    margin-bottom: 10px;
    width: 280px;
    font-size: 14px;
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

  .toast-success {
    background-color: color-mix(in srgb, var(--c-success) 85%, var(--c-black));
    border-color: color-mix(in srgb, var(--c-success) 40%, transparent);
  }

  .toast-error {
    background-color: color-mix(in srgb, var(--c-error) 85%, var(--c-black));
    border-color: color-mix(in srgb, var(--c-error) 40%, transparent);
  }

  .toast-warning {
    background-color: color-mix(in srgb, var(--c-warning) 80%, var(--c-black));
    border-color: color-mix(in srgb, var(--c-warning) 40%, transparent);
  }

  .toast-info {
    background-color: color-mix(in srgb, var(--c-info) 85%, var(--c-black));
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
    line-height: 1.4;
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

  button.close-btn :global(svg) {
    position: relative;
    z-index: 2;
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

  @keyframes rise-fill {
    from {
      height: 0%;
    }
    to {
      height: 100%;
    }
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
