<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly } from 'svelte/transition'
  import type { ToastFillingType } from '$lib/toaster/types/ToastFillingType'
  import { toastStore } from '$lib/toaster/stores/toastStore'

  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  const clearTimer = (id: number) => {
    if (timers.has(id)) {
      clearTimeout(timers.get(id))
      timers.delete(id)
    }
  }
  const setRemovalTimer = (toast: ToastFillingType) => {
    if (!toast.duration) return
    const timer = setTimeout(() => {
      removeToast(toast.id)
    }, toast.duration)
    timers.set(toast.id, timer)
  }
  const removeToast = (id: number) => {
    toastStore.update(n => n.filter(t => t.id !== id))
    clearTimer(id)
  }

  let toasts: ToastFillingType[] = $state([])
  toastStore.subscribe(value => {
    toasts = value
    toasts.forEach(setRemovalTimer)
  })
</script>

<div class="toaster">
  {#each toasts as { id, type, title, message } (id)}
    <div
      class="toast"
      animate:flip={{ duration: 500 }}
      in:fly={{ duration: 300 }}
      out:fly={{ duration: 300 }}
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
          onclick={() => removeToast(id)}
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
  }
  .toast {
    border-radius: var(--rounded-md);
    background: var(--c-white);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    color: var(--c-black);
    margin-bottom: 10px;
    width: 220px;
    font-size: 14px;
    padding: 10px 15px;
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
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem;
    margin-right: -0.5rem;
    border-radius: 50%;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  button:hover {
    background-color: #eee;
  }

  .title {
    display: flex;
    align-items: center;
  }
</style>
