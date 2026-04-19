<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import Settings from 'lucide-svelte/icons/settings'
  import Check from 'lucide-svelte/icons/check'
  import { getGazePlotterSession } from '$lib/session'
  import { portal } from '$lib/context-menu/utils'
  import { metricLibraryModal } from './metricLibraryModal'
  import {
    formatParamReadout,
    formatWindowingReadout,
    type MetricInstance,
  } from '$lib/metrics'
  import type { WindowingConfig } from '$lib/data/types'

  interface Props {
    instances: readonly MetricInstance[]
    selectedIds: number[]
    onchange: (ids: number[]) => void
    onrenameInstance?: (id: number, label: string) => void
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      windowing?: WindowingConfig,
      replacingId?: number,
    ) => void
    ondeleteInstance?: (id: number) => void
    context?: 'global' | 'windowed'
    label?: string
  }

  let {
    instances,
    selectedIds,
    onchange,
    onrenameInstance,
    oncreateInstance,
    ondeleteInstance,
    context = 'global',
    label,
  }: Props = $props()

  const { modalState } = getGazePlotterSession()

  let isOpen = $state(false)
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let dropdownEl = $state<HTMLDivElement | null>(null)
  let dropdownStyle = $state('')

  const selectedSet = $derived(new Set(selectedIds))

  const triggerLine1 = $derived.by(() => {
    if (context === 'windowed') {
      const sel = instances.find(i => selectedSet.has(i.id))
      return sel?.label ?? 'Choose metric…'
    }
    const count = selectedIds.filter(id => instances.some(i => i.id === id)).length
    if (count === 0) return 'No metrics selected'
    if (count <= 2) {
      const names = instances.filter(i => selectedSet.has(i.id)).map(i => i.label)
      if (names.length > 0) return names.join(', ')
    }
    return `${count} metrics selected`
  })

  const triggerLine2 = $derived.by(() => {
    if (context !== 'windowed') return ''
    const sel = instances.find(i => selectedSet.has(i.id))
    if (!sel) return ''
    const readout = formatParamReadout(sel)
    const winLine = formatWindowingReadout(sel)
    return [...readout, ...(winLine ? [winLine] : [])].join(' · ')
  })

  function openDropdown() {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    dropdownStyle = `left:${rect.left}px; top:${rect.bottom + 4}px; min-width:${rect.width}px;`
    isOpen = true
  }

  function closeDropdown() {
    isOpen = false
  }

  function toggle() {
    if (isOpen) closeDropdown()
    else openDropdown()
  }

  $effect(() => {
    if (!isOpen) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (!triggerEl?.contains(target) && !dropdownEl?.contains(target)) {
        closeDropdown()
      }
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  })

  function toggleMetric(id: number) {
    if (context === 'windowed') {
      onchange([id])
      closeDropdown()
    } else if (selectedSet.has(id)) {
      onchange(selectedIds.filter(x => x !== id))
    } else {
      onchange([...selectedIds, id])
    }
  }
</script>

<div class="metric-select">
  {#if label}
    <label class="select-label">{label}</label>
  {/if}
  <button
    bind:this={triggerEl}
    class="trigger"
    class:open={isOpen}
    onclick={toggle}
    aria-expanded={isOpen}
    aria-haspopup="listbox"
    type="button"
  >
    <span class="trigger-body">
      <span class="trigger-line1" class:placeholder={!instances.some(i => selectedSet.has(i.id))}>
        {triggerLine1}
      </span>
      {#if triggerLine2}
        <span class="trigger-line2">{triggerLine2}</span>
      {/if}
    </span>
    <span class="chevron" class:rotated={isOpen}>
      <ChevronDown size={14} strokeWidth={1.5} />
    </span>
  </button>

  {#if isOpen}
    <div bind:this={dropdownEl} class="dropdown" style={dropdownStyle} use:portal>
      <button
        class="dd-action"
        type="button"
        onclick={() => {
          closeDropdown()
          modalState.open(metricLibraryModal, {
            context,
            oncreateInstance,
            ondeleteInstance,
            onrenameInstance,
          })
        }}
      >
        <Settings size={13} strokeWidth={1.5} />
        Edit library…
      </button>
      <div class="dd-divider"></div>
      {#each instances as inst (inst.id)}
        {@const isSelected = selectedSet.has(inst.id)}
        {@const readout = formatParamReadout(inst)}
        {@const winLine = formatWindowingReadout(inst)}
        {@const detail = [...readout, ...(winLine ? [winLine] : [])].join(' · ')}
        <button
          class="dd-item"
          class:is-selected={isSelected}
          type="button"
          onclick={() => toggleMetric(inst.id)}
        >
          {#if context === 'global'}
            <span class="checkbox" class:checked={isSelected}>
              {#if isSelected}<Check size={10} strokeWidth={2.5} />{/if}
            </span>
          {:else}
            <span class="radio" class:checked={isSelected}></span>
          {/if}
          <span class="item-body">
            <span class="item-name">{inst.label}</span>
            {#if detail}<span class="item-detail">{detail}</span>{/if}
          </span>
        </button>
      {/each}
      {#if instances.length === 0}
        <div class="dd-empty">No metrics. Click "Edit library…" to add one.</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .metric-select {
    width: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .select-label {
    font-size: 12px;
    color: var(--c-darkgrey);
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  .trigger {
    width: 100%;
    background: var(--c-white);
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    padding: 5px 28px 5px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    transition: background 0.15s, color 0.15s;
    box-sizing: border-box;
    text-align: left;
    height: 46px;
  }

  .trigger:hover,
  .trigger.open {
    background: #f6f7f9;
  }

  .trigger-body {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
    flex: 1;
  }

  .trigger-line1 {
    font-size: 11.5px;
    color: var(--c-black);
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .trigger-line1.placeholder { color: var(--c-darkgrey); }

  .trigger-line2 {
    font-size: 8.5px;
    color: var(--c-darkgrey);
    line-height: 1;
    margin-top: 0.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chevron {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--c-darkgrey);
    line-height: 0;
    pointer-events: none;
    transition: transform 0.15s;
  }
  .chevron.rotated { transform: translateY(-50%) rotate(180deg); }

  /* Dropdown */
  .dropdown {
    position: fixed;
    z-index: 9999;
    background: var(--c-white);
    border: 1px solid var(--c-border, var(--c-midgrey));
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 4px 0;
    max-height: 320px;
    overflow-y: auto;
  }

  .dd-action {
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--c-darkgrey);
    padding: 7px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    transition: background 0.1s, color 0.1s;
    border-radius: 4px;
    margin: 0 4px;
    width: calc(100% - 8px);
    box-sizing: border-box;
  }
  .dd-action:hover { background: var(--c-lightgrey); color: var(--c-text); }

  .dd-divider {
    height: 1px;
    background: var(--c-grey);
    margin: 4px 0;
  }

  .dd-item {
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    transition: background 0.1s;
    border-radius: 4px;
    margin: 0 4px;
    width: calc(100% - 8px);
    box-sizing: border-box;
  }
  .dd-item:hover { background: var(--c-lightgrey); }
  .dd-item.is-selected { background: color-mix(in srgb, var(--c-brand) 6%, var(--c-white)); }
  .dd-item.is-selected:hover { background: color-mix(in srgb, var(--c-brand) 10%, var(--c-white)); }

  .checkbox {
    width: 10px;
    height: 10px;
    border: 1.5px solid var(--c-midgrey);
    border-radius: 2px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-white);
    background: var(--c-white);
    transition: background 0.1s, border-color 0.1s;
  }
  .checkbox.checked {
    background: var(--c-brand);
    border-color: var(--c-brand);
  }

  .radio {
    width: 10px;
    height: 10px;
    border: 1.5px solid var(--c-midgrey);
    border-radius: 50%;
    flex-shrink: 0;
    transition: border-color 0.1s;
    position: relative;
  }
  .radio.checked {
    border-color: var(--c-brand);
  }
  .radio.checked::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--c-brand);
  }

  .item-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .item-name {
    font-size: 13px;
    color: var(--c-text);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-detail {
    font-size: 10px;
    color: var(--c-darkgrey);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dd-empty {
    font-size: 12px;
    color: var(--c-darkgrey);
    padding: 10px 12px;
    text-align: center;
  }
</style>
