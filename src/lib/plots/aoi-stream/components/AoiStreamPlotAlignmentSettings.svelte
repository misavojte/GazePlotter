<script lang="ts">
  import { type MenuItem } from '$lib/context-menu'
  import GeneralInputNumber from '$lib/shared/components/GeneralInputNumber.svelte'

  interface Props {
    item: MenuItem
    defaultValue: number
    defaultValueScale?: number
    placeholder?: string
    action: (data: { binSize: string; ridgelineScale?: string }) => void
    close: () => void
  }

  let {
    item,
    defaultValue,
    defaultValueScale = 2.5,
    placeholder = 'Bin Size [ms]',
    action,
    close,
  }: Props = $props()

  let binSize = $state(0)
  let scale = $state(0)

  // Update local state if prop changes
  $effect(() => {
    if (defaultValue !== undefined) {
      binSize = defaultValue
    }
    if (defaultValueScale !== undefined) {
      scale = defaultValueScale
    }
  })

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    const data: { binSize: string; ridgelineScale?: string } = {
      binSize: binSize.toString(),
    }

    if (item.value === 'ridgeline') {
      data.ridgelineScale = scale.toString()
    }

    action(data)
    close()
  }
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit} class="flex flex-col gap-3">
    <GeneralInputNumber label={placeholder} bind:value={binSize} min={1} />
    {#if item.value === 'ridgeline'}
      <GeneralInputNumber
        label="Ridge Scale"
        bind:value={scale}
        min={0.1}
        step={0.1}
      />
    {/if}
    <button type="submit" class="apply-btn">
      Apply {item.label} Alignment
    </button>
  </form>
</div>

<style>
  .settings-container {
    padding: 16px 14px;
    width: 220px;
    box-sizing: border-box;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .apply-btn {
    width: 100%;
    background: var(--c-brand);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: var(--rounded);
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
    transition: filter 0.2s;
  }

  .apply-btn:hover {
    filter: brightness(1.1);
  }

  .apply-btn:active {
    filter: brightness(0.9);
  }
</style>
