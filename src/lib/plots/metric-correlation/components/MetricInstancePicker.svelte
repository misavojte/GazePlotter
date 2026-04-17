<script lang="ts">
  import ChevronUp from 'lucide-svelte/icons/chevron-up'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import Plus from 'lucide-svelte/icons/plus'
  import X from 'lucide-svelte/icons/x'
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
  import Search from 'lucide-svelte/icons/search'
  import {
    METRIC_CATEGORY_ORDER,
    METRIC_CATEGORY_LABELS,
    getMetricDef,
    formatParamReadout,
    type MetricInstance,
  } from '$lib/plots/metrics'

  interface Props {
    instances: readonly MetricInstance[]
    selectedIds: number[]
    onchange: (ids: number[]) => void
    onrenameInstance?: (id: number, label: string) => void
  }

  let { instances, selectedIds, onchange, onrenameInstance }: Props = $props()

  let paletteOpen = $state(false)
  let searchQuery = $state('')
  let renamingId = $state<number | null>(null)
  let renameDraft = $state('')

  const selectedSet = $derived(new Set(selectedIds))

  const activeInstances = $derived(
    selectedIds
      .map(id => instances.find(i => i.id === id))
      .filter((i): i is MetricInstance => !!i)
  )

  const pairCount = $derived(
    activeInstances.length < 2
      ? 0
      : (activeInstances.length * (activeInstances.length - 1)) / 2
  )

  type PaletteGroup = {
    key: string
    label: string
    items: MetricInstance[]
  }

  const paletteGroups = $derived.by<PaletteGroup[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    const buckets = new Map<string, MetricInstance[]>()

    for (const inst of instances) {
      if (selectedSet.has(inst.id)) continue
      const def = getMetricDef(inst.baseId)
      if (!def) continue

      if (q.length > 0) {
        const hay = [
          inst.label,
          def.label,
          ...formatParamReadout(inst),
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) continue
      }

      if (!buckets.has(def.category)) buckets.set(def.category, [])
      buckets.get(def.category)!.push(inst)
    }

    return METRIC_CATEGORY_ORDER.filter(k => buckets.has(k)).map(k => ({
      key: k,
      label: METRIC_CATEGORY_LABELS[k] ?? k,
      items: buckets.get(k)!,
    }))
  })

  function addInstance(id: number) {
    if (selectedSet.has(id)) return
    onchange([...selectedIds, id])
    paletteOpen = false
    searchQuery = ''
  }

  function removeInstance(id: number) {
    onchange(selectedIds.filter(x => x !== id))
  }

  function moveInstance(index: number, delta: number) {
    const next = [...selectedIds]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onchange(next)
  }

  function clearAll() {
    onchange([])
  }

  function beginRename(inst: MetricInstance) {
    if (!onrenameInstance) return
    renamingId = inst.id
    renameDraft = inst.label
  }

  function commitRename() {
    if (renamingId === null) return
    const id = renamingId
    const label = renameDraft.trim()
    renamingId = null
    renameDraft = ''
    if (label.length === 0) return
    onrenameInstance?.(id, label)
  }

  function cancelRename() {
    renamingId = null
    renameDraft = ''
  }

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelRename()
    }
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus()
    node.select()
  }
</script>

<div class="picker">
  <div class="header">
    <span class="counter"
      >{activeInstances.length} selected{activeInstances.length >= 2
        ? ` · ${pairCount} pairs`
        : ''}</span
    >
    {#if activeInstances.length > 0 && !paletteOpen}
      <button class="clear" type="button" onclick={clearAll}>Clear</button>
    {/if}
  </div>

  {#if !paletteOpen}
    {#if activeInstances.length === 0}
      <div class="empty">No metrics selected.</div>
    {:else}
      <ul class="active-list">
        {#each activeInstances as inst, i (inst.id)}
          {@const readout = formatParamReadout(inst)}
          <li class="active-item">
            <div class="reorder">
              <button
                type="button"
                class="arrow"
                onclick={() => moveInstance(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
              >
                <ChevronUp size={12} />
              </button>
              <button
                type="button"
                class="arrow"
                onclick={() => moveInstance(i, 1)}
                disabled={i === activeInstances.length - 1}
                aria-label="Move down"
              >
                <ChevronDown size={12} />
              </button>
            </div>
            <div class="item-body">
              {#if renamingId === inst.id}
                <input
                  class="rename-input"
                  type="text"
                  bind:value={renameDraft}
                  onkeydown={onRenameKeydown}
                  onblur={commitRename}
                  aria-label="Rename metric"
                  use:focusOnMount
                />
              {:else}
                <button
                  type="button"
                  class="item-label"
                  ondblclick={() => beginRename(inst)}
                  title={onrenameInstance ? 'Double-click to rename' : undefined}
                >
                  {inst.label}
                </button>
              {/if}
              {#if readout.length > 0}
                <div class="item-params">{readout.join(' · ')}</div>
              {/if}
            </div>
            <button
              type="button"
              class="remove"
              onclick={() => removeInstance(inst.id)}
              aria-label="Remove metric"
            >
              <X size={12} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <button class="add" type="button" onclick={() => (paletteOpen = true)}>
      <Plus size={12} /> Add metric
    </button>
  {:else}
    <div class="palette-header">
      <button
        type="button"
        class="back"
        onclick={() => {
          paletteOpen = false
          searchQuery = ''
        }}
        aria-label="Back to selected metrics"
      >
        <ArrowLeft size={12} />
      </button>
      <div class="search">
        <Search size={12} />
        <input
          type="text"
          placeholder="Search..."
          bind:value={searchQuery}
          aria-label="Search metrics"
        />
      </div>
    </div>

    {#if paletteGroups.length === 0}
      <div class="empty">No matching metrics.</div>
    {:else}
      <div class="palette-list">
        {#each paletteGroups as group (group.key)}
          <div class="group">
            <div class="group-label">{group.label}</div>
            {#each group.items as inst (inst.id)}
              {@const readout = formatParamReadout(inst)}
              <button
                type="button"
                class="palette-item"
                onclick={() => addInstance(inst.id)}
              >
                <div class="item-label">{inst.label}</div>
                {#if readout.length > 0}
                  <div class="item-params">{readout.join(' · ')}</div>
                {/if}
              </button>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2px;
  }
  .counter {
    font-size: 11px;
    color: var(--c-darkgrey);
  }
  .clear {
    background: none;
    border: none;
    color: var(--c-darkgrey);
    font-size: 11px;
    cursor: pointer;
    padding: 2px 4px;
  }
  .clear:hover {
    color: var(--c-text);
    text-decoration: underline;
  }

  .empty {
    font-size: 11px;
    color: var(--c-darkgrey);
    padding: 8px;
    text-align: center;
  }

  .active-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 240px;
    overflow-y: auto;
  }

  .active-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 4px;
    align-items: center;
    padding: 4px 6px;
    border-radius: 4px;
    background: var(--c-lightergrey, #f5f5f5);
  }

  .reorder {
    display: flex;
    flex-direction: column;
  }
  .arrow {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    padding: 1px;
    line-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .arrow:hover:not(:disabled) {
    color: var(--c-text);
  }
  .arrow:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .item-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .item-label {
    font-size: 12px;
    color: var(--c-text);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: text;
    font: inherit;
    font-size: 12px;
    color: var(--c-text);
  }
  .rename-input {
    font-size: 12px;
    line-height: 1.2;
    padding: 1px 4px;
    border: 1px solid var(--c-lightgrey, #d0d0d0);
    border-radius: 3px;
    background: var(--c-background, #fff);
    color: var(--c-text);
    outline: none;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .rename-input:focus {
    border-color: var(--c-brand, #4a90e2);
  }
  .item-params {
    font-size: 10px;
    color: var(--c-darkgrey);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    padding: 2px;
    line-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
  }
  .remove:hover {
    background: var(--c-lightgrey, #e5e5e5);
    color: var(--c-text);
  }

  .add {
    background: none;
    border: 1px dashed var(--c-lightgrey, #d0d0d0);
    cursor: pointer;
    font-size: 11px;
    color: var(--c-darkgrey);
    padding: 4px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
  }
  .add:hover {
    border-color: var(--c-darkgrey);
    color: var(--c-text);
  }

  .palette-header {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .back {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    padding: 2px;
    line-height: 0;
    display: flex;
  }
  .back:hover {
    color: var(--c-text);
  }
  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border: 1px solid var(--c-lightgrey, #d0d0d0);
    border-radius: 4px;
    background: var(--c-background, #fff);
  }
  .search input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-size: 12px;
    min-width: 0;
  }

  .palette-list {
    max-height: 260px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .group-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--c-darkgrey);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 4px;
  }
  .palette-item {
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 4px 8px;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .palette-item:hover {
    background: var(--c-lightergrey, #f5f5f5);
  }
</style>
