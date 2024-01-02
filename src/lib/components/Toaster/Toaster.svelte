<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly } from 'svelte/transition'
  import type { ToastFillingType } from '$lib/type/Filling/ToastFilling/ToastFillingType'
  import { toastStore } from '$lib/stores/toastStore'

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

  let toasts: ToastFillingType[] = []
  toastStore.subscribe(
    (value) => {
      toasts = value
      toasts.forEach(setRemovalTimer)
    }
  )

</script>

<div class="toaster">
{#each toasts as { id, type, title, message } (id)}
    <div class="toast" animate:flip={{ duration: 500 }} in:fly={{ duration: 150, x: '100%' }} out:fly={{ duration: 150, x: '100%' }}>
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
            <button type="button" class="close" aria-label="Close" on:click={() => removeToast(id)}>
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
    }
    .toast {
        border-radius: 0.5rem;
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
        background: #22c55e;
    }

    .error {
        background: #ff4d4f;
    }

    .warning {
        background: #faad14;
    }

    .info {
        background: #1890ff;
    }

    .toast-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;
    }

    button {
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