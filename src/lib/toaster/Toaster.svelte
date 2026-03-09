<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly } from 'svelte/transition'
  import type { ToastFillingType } from './types'
  import { getToastState } from '$lib/session'

  const toastState = getToastState()

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
  {#each toastState.current as { id, type, title, message } (id)}
    <div
      class="toast"
      animate:flip={{ duration: 500 }}
      in:fly={{ duration: 300, x: 20 }}
      out:fly={{ duration: 300, x: 20 }}
    >
      <div class="toast-header">
        <div class="title">
          <strong>{title}</strong>
          {#if type === 'success'}
            <span class="circle success"></span>
          {:else if type === 'error'}
            <span class="circle error"></span>
          {:else if type === 'warning'}
            <span class="circle warning"></span>
          {:else if type === 'info'}
            <span class="circle info"></span>
          {/if}
        </div>
        <button
          type="button"
          class="close"
          aria-label="Close"
          onclick={() => handleManualClose(id)}
        >
          ×
        </button>
      </div>
      <div class="toast-body">
        {message}
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
    width: 250px;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    border-radius: var(--rounded-md);
    background: var(--c-white);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    color: var(--c-black);
    margin-bottom: 10px;
    width: 220px;
    font-size: 14px;
    padding: 10px 15px;
    border: 1px solid var(--c-border);
  }

  .circle {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
    margin-left: 10px;
  }

  .success {
    background: var(--c-success);
  }

  .error {
    background: var(--c-error);
  }

  .warning {
    background: var(--c-warning);
  }

  .info {
    background: var(--c-info);
  }

  .toast-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }

  button.close {
    border: none;
    background-color: transparent;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0;
    margin-right: -5px;
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--c-midgrey);
    transition: color 0.2s;
  }
  button.close:hover {
    color: var(--c-black);
  }

  .title {
    display: flex;
    align-items: center;
  }
</style>
