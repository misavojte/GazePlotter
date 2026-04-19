<script lang="ts">
  import { flip } from 'svelte/animate'
  import { cubicOut } from 'svelte/easing'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import Plus from 'lucide-svelte/icons/plus'
  import X from 'lucide-svelte/icons/x'
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
  import Search from 'lucide-svelte/icons/search'
  import Pencil from 'lucide-svelte/icons/pencil'
  import Trash2 from 'lucide-svelte/icons/trash-2'
  import { createDragReorder } from '$lib/shared/actions/dragReorder'
  import { InputNumber, Select } from '$lib/shared/components'
  import type { SelectOption } from '$lib/shared/components'
  import {
    METRIC_DEFS,
    METRIC_CATEGORY_ORDER,
    METRIC_CATEGORY_LABELS,
    getMetricDef,
    formatParamReadout,
    formatWindowingReadout,
    defaultInstanceLabel,
    type MetricInstance,
    type MetricParamDef,
    type MetricComputationMode,
  } from '$lib/plots/metrics'
  import type { WindowingConfig } from '$lib/data/types'

  interface Props {
    instances: readonly MetricInstance[]
    selectedIds: number[]
    onchange: (ids: number[]) => void
    onrenameInstance?: (id: number, label: string) => void
    oncreateInstance?: (baseId: string, params: Record<string, unknown>, label: string, windowing?: WindowingConfig) => void
    ondeleteInstance?: (id: number) => void
    showWindowing?: boolean
  }

  let {
    instances,
    selectedIds,
    onchange,
    onrenameInstance,
    oncreateInstance,
    ondeleteInstance,
    showWindowing = false,
  }: Props = $props()

  // Active list state
  let paletteOpen = $state(false)
  let renamingId = $state<number | null>(null)
  let renameDraft = $state('')
  let dragItemId = $state<number | null>(null)

  // Palette state
  let searchQuery = $state('')
  let renamingPaletteId = $state<number | null>(null)
  let renamingPaletteDraft = $state('')

  // Create form state
  let creatingBaseId = $state<string | null>(null)
  let paramDraft = $state<Record<string, unknown>>({})
  let labelOverride = $state('')
  let createMode = $state<MetricComputationMode>('global')
  let windowSize = $state(20)
  let windowReduction = $state<WindowingConfig['reduction']>('mean')

  const selectedSet = $derived(new Set(selectedIds))

  function isCreatable(d: (typeof METRIC_DEFS)[number]): boolean {
    if (d.params && d.params.length > 0) return true
    return showWindowing && !!(d.computationModes && d.computationModes.length > 1)
  }

  const activeInstances = $derived(
    selectedIds
      .map(id => instances.find(i => i.id === id))
      .filter((i): i is MetricInstance => !!i)
  )

  type PaletteGroup = {
    key: string
    label: string
    items: MetricInstance[]
    creatableDefs: (typeof METRIC_DEFS)[number][]
  }

  const paletteGroups = $derived.by<PaletteGroup[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    const buckets = new Map<string, MetricInstance[]>()

    for (const inst of instances) {
      if (selectedSet.has(inst.id)) continue
      const def = getMetricDef(inst.baseId)
      if (!def) continue

      if (q.length > 0) {
        const hay = [inst.label, def.label, ...formatParamReadout(inst)]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) continue
      }

      if (!buckets.has(def.category)) buckets.set(def.category, [])
      buckets.get(def.category)!.push(inst)
    }

    return METRIC_CATEGORY_ORDER.filter(key => {
      const hasInstances = buckets.has(key)
      const hasCreatable = METRIC_DEFS.some(d => d.category === key && isCreatable(d))
      return hasInstances || hasCreatable
    }).map(key => ({
      key,
      label: METRIC_CATEGORY_LABELS[key] ?? key,
      items: buckets.get(key) ?? [],
      creatableDefs: METRIC_DEFS.filter(d => d.category === key && isCreatable(d)),
    }))
  })

  const liveLabel = $derived.by(() => {
    if (!creatingBaseId) return ''
    const override = labelOverride.trim()
    return override.length > 0 ? override : defaultInstanceLabel(creatingBaseId, paramDraft)
  })

  const dragHandle = createDragReorder({
    itemSelector: '.metrics-item',
    containerSelector: '.metrics-list',
    onDragStart: (id) => { dragItemId = id },
    onDragEnd: () => { dragItemId = null },
    onReorder: (from, to) => {
      const next = [...selectedIds]
      const [removed] = next.splice(from, 1)
      next.splice(to, 0, removed)
      onchange(next)
    },
  })

  // --- Active list ---

  function addInstance(id: number) {
    if (selectedSet.has(id)) return
    onchange([...selectedIds, id])
    paletteOpen = false
    searchQuery = ''
  }

  function removeInstance(id: number) {
    onchange(selectedIds.filter(x => x !== id))
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
    if (label.length > 0) onrenameInstance?.(id, label)
  }

  function cancelRename() {
    renamingId = null
    renameDraft = ''
  }

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
    else if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
  }

  // --- Palette rename ---

  function beginPaletteRename(inst: MetricInstance) {
    creatingBaseId = null
    renamingPaletteId = inst.id
    renamingPaletteDraft = inst.label
  }

  function commitPaletteRename() {
    if (renamingPaletteId === null) return
    const id = renamingPaletteId
    const label = renamingPaletteDraft.trim()
    renamingPaletteId = null
    renamingPaletteDraft = ''
    if (label.length > 0) onrenameInstance?.(id, label)
  }

  function cancelPaletteRename() {
    renamingPaletteId = null
    renamingPaletteDraft = ''
  }

  function onPaletteRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitPaletteRename() }
    else if (e.key === 'Escape') { e.preventDefault(); cancelPaletteRename() }
  }

  // --- Create form ---

  function openCreate(baseId: string) {
    renamingPaletteId = null
    creatingBaseId = baseId
    const def = getMetricDef(baseId)
    paramDraft = Object.fromEntries((def?.params ?? []).map(p => [p.id, p.default]))
    labelOverride = ''
    createMode = 'global'
    windowSize = def?.category === 'rqa-aoi' ? 20 : 2000
    windowReduction = 'mean'
  }

  function cancelCreate() {
    creatingBaseId = null
    paramDraft = {}
    labelOverride = ''
    createMode = 'global'
  }

  function commitCreate() {
    if (!creatingBaseId || !oncreateInstance) return
    const baseId = creatingBaseId
    const params = { ...paramDraft }
    const label = labelOverride.trim() || defaultInstanceLabel(baseId, params)
    const windowing: WindowingConfig | undefined = createMode === 'global'
      ? undefined
      : { mode: createMode as 'epoch' | 'sliding', windowSize, reduction: windowReduction }
    cancelCreate()
    oncreateInstance(baseId, params, label, windowing)
    paletteOpen = false
    searchQuery = ''
  }

  function paramSelectOptions(p: MetricParamDef): SelectOption[] {
    return (p.options ?? []).map(o => ({ label: o.label, value: o.value }))
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus()
    node.select()
  }
</script>

<div class="picker">
  {#if !paletteOpen}
    <!-- Active list -->
    {#if activeInstances.length === 0}
      <div class="empty">No metrics selected.</div>
    {:else}
      <ul class="metrics-list">
        {#each activeInstances as inst (inst.id)}
          {@const readout = formatParamReadout(inst)}
          {@const winLine = formatWindowingReadout(inst)}
          <li
            class="metrics-item"
            class:dragging={dragItemId === inst.id}
            animate:flip={{ duration: dragItemId === inst.id ? 0 : 150, easing: cubicOut }}
          >
            <div class="grip" use:dragHandle={inst.id} aria-hidden="true">
              <GripVertical size={13} />
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
              {#if winLine}
                <div class="item-params">{winLine}</div>
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

    <div class="picker-footer">
      <button class="add" type="button" onclick={() => (paletteOpen = true)}>
        <Plus size={12} /> Add metric
      </button>
    </div>
  {:else}
    <!-- Palette (library view) -->
    <div class="palette-header">
      <button
        type="button"
        class="back"
        onclick={() => {
          paletteOpen = false
          searchQuery = ''
          cancelCreate()
          cancelPaletteRename()
        }}
        aria-label="Back to selected metrics"
      >
        <ArrowLeft size={12} />
      </button>
      <div class="search">
        <Search size={12} />
        <input
          type="text"
          placeholder="Search…"
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
              {#if renamingPaletteId === inst.id}
                <input
                  class="palette-rename-input"
                  type="text"
                  bind:value={renamingPaletteDraft}
                  onblur={commitPaletteRename}
                  onkeydown={onPaletteRenameKeydown}
                  aria-label="Rename metric"
                  use:focusOnMount
                />
              {:else if inst.id >= 1000}
                <!-- User instance: label click to add + manage icons -->
                <div class="palette-row">
                  <button
                    type="button"
                    class="palette-row-label"
                    onclick={() => addInstance(inst.id)}
                  >
                    <div class="palette-item-label">
                      <span class="item-plus">+</span>
                      {inst.label}
                    </div>
                    {#if readout.length > 0}
                      <div class="item-params">{readout.join(' · ')}</div>
                    {/if}
                  </button>
                  <div class="palette-row-actions">
                    <button
                      type="button"
                      class="action-icon"
                      onclick={() => beginPaletteRename(inst)}
                      aria-label="Rename"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      class="action-icon danger"
                      onclick={() => ondeleteInstance?.(inst.id)}
                      aria-label="Delete from library"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              {:else}
                <!-- System instance: click to add, no icons -->
                <button
                  type="button"
                  class="palette-item"
                  onclick={() => addInstance(inst.id)}
                >
                  <div class="palette-item-label">
                    <span class="item-plus">+</span>
                    {inst.label}
                  </div>
                  {#if readout.length > 0}
                    <div class="item-params">{readout.join(' · ')}</div>
                  {/if}
                </button>
              {/if}
            {/each}

            {#each group.creatableDefs as def (def.id)}
              {#if creatingBaseId === def.id}
                <form
                  class="create-form"
                  onsubmit={e => { e.preventDefault(); commitCreate() }}
                  onkeydown={e => { if (e.key === 'Escape') { e.preventDefault(); cancelCreate() } }}
                >
                  <div class="create-form-title">New {def.label} variant</div>
                  {#each def.params ?? [] as param (param.id)}
                    <div class="param-row">
                      {#if param.type === 'enum'}
                        <Select
                          label={param.label}
                          options={paramSelectOptions(param)}
                          value={String(paramDraft[param.id] ?? param.default)}
                          onchange={e => {
                            paramDraft = { ...paramDraft, [param.id]: (e as CustomEvent<string>).detail }
                          }}
                        />
                      {:else if param.type === 'integer' || param.type === 'number'}
                        <InputNumber
                          id={`param-${def.id}-${param.id}`}
                          label={param.label}
                          value={Number(paramDraft[param.id] ?? param.default)}
                          min={param.min}
                          max={param.max}
                          step={param.type === 'integer' ? 1 : (param.step ?? 0.01)}
                          appearance="compact"
                          onValueChange={v => {
                            if (v !== undefined) paramDraft = { ...paramDraft, [param.id]: v }
                          }}
                        />
                      {:else if param.type === 'boolean'}
                        <label class="bool-label">
                          <input
                            type="checkbox"
                            checked={Boolean(paramDraft[param.id] ?? param.default)}
                            onchange={e => {
                              paramDraft = { ...paramDraft, [param.id]: (e.target as HTMLInputElement).checked }
                            }}
                          />
                          {param.label}
                        </label>
                      {/if}
                    </div>
                  {/each}
                  {#if showWindowing && def.computationModes && def.computationModes.length > 1}
                    <div class="windowing-section">
                      <div class="param-label">Computation</div>
                      <div class="mode-tabs">
                        {#each def.computationModes as mode}
                          <button
                            type="button"
                            class="mode-tab"
                            class:active={createMode === mode}
                            onclick={() => { createMode = mode }}
                          >
                            {mode === 'global' ? 'Global' : mode === 'epoch' ? 'Epoch' : 'Sliding'}
                          </button>
                        {/each}
                      </div>
                      {#if createMode !== 'global'}
                        <div class="window-row">
                          <label class="param-label" for={`window-${def.id}`}>Window</label>
                          <div class="window-input-group">
                            <input
                              id={`window-${def.id}`}
                              class="window-input"
                              type="number"
                              bind:value={windowSize}
                              min={def.category === 'rqa-aoi' ? 15 : 500}
                              step={def.category === 'rqa-aoi' ? 1 : 500}
                            />
                            <span class="window-unit">{def.category === 'rqa-aoi' ? 'fixations' : 'ms'}</span>
                          </div>
                        </div>
                        {#if def.category === 'rqa-aoi' && windowSize < 20}
                          <div class="field-hint">Recommended ≥ 20 fixations for stable DET / LAM estimates</div>
                        {/if}
                        <div class="window-row">
                          <label class="param-label" for={`reduction-${def.id}`}>Reduce by</label>
                          <select id={`reduction-${def.id}`} class="reduction-select" bind:value={windowReduction}>
                            <option value="mean">Mean</option>
                            <option value="max">Max</option>
                            <option value="min">Min</option>
                            <option value="final">Final</option>
                          </select>
                        </div>
                        {#if createMode === 'sliding'}
                          <div class="field-hint">Step = 1 fixation (fully overlapping). Prefer Max / Min / Final to characterise temporal dynamics.</div>
                        {/if}
                      {/if}
                    </div>
                  {/if}
                  <div class="create-label-row">
                    <label class="param-label" for={`label-${def.id}`}>Label</label>
                    <input
                      id={`label-${def.id}`}
                      class="label-input"
                      type="text"
                      bind:value={labelOverride}
                      placeholder={liveLabel}
                    />
                  </div>
                  <div class="create-footer">
                    <button type="submit" class="btn-create">Create & add</button>
                    <button type="button" class="btn-cancel" onclick={cancelCreate}>Cancel</button>
                  </div>
                </form>
              {:else}
                <button
                  type="button"
                  class="create-row"
                  onclick={() => openCreate(def.id)}
                >
                  <Plus size={11} /> New {def.label} variant…
                </button>
              {/if}
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

  .empty {
    font-size: 11px;
    color: var(--c-darkgrey);
    padding: 8px;
    text-align: center;
  }

  /* ── Active list ── */

  .metrics-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 240px;
    overflow-y: auto;
  }

  .metrics-item {
    display: grid;
    grid-template-columns: 16px 1fr auto;
    gap: 6px;
    align-items: center;
    padding: 5px 8px;
    border-radius: var(--rounded);
    background: var(--c-lightgrey);
  }

  .metrics-item.dragging {
    opacity: 0.3;
    outline: 1px dashed var(--c-midgrey);
    background: transparent;
  }

  .grip {
    color: var(--c-midgrey);
    cursor: grab;
    line-height: 0;
    opacity: 0.35;
    transition: opacity 0.1s;
    display: flex;
    align-items: center;
  }
  .metrics-item:hover .grip,
  .metrics-item:focus-within .grip { opacity: 1; }
  .grip:active { cursor: grabbing; }

  .item-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
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
  }

  .rename-input {
    font-size: 12px;
    line-height: 1.2;
    padding: 1px 4px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    background: var(--c-white);
    color: var(--c-text);
    outline: none;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .rename-input:focus { border-color: var(--c-brand); }

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
    padding: 3px;
    line-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--rounded);
  }
  .remove:hover { background: var(--c-grey); color: var(--c-text); }

  /* ── Footer ── */

  .picker-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;
  }

  .add {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: var(--c-darkgrey);
    padding: 2px 4px;
    margin-left: -4px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--rounded);
  }
  .add:hover { color: var(--c-text); background: var(--c-lightgrey); }

  /* ── Palette header ── */

  .palette-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .back {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    padding: 3px;
    line-height: 0;
    display: flex;
    border-radius: var(--rounded);
    flex-shrink: 0;
  }
  .back:hover { color: var(--c-text); background: var(--c-lightgrey); }

  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    background: var(--c-white);
  }
  .search input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-size: 12px;
    min-width: 0;
    color: var(--c-text);
  }
  .search input::placeholder { color: var(--c-midgrey); }

  /* ── Palette list ── */

  .palette-list {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .group-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--c-darkgrey);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0 8px 4px;
  }

  .palette-item-label {
    display: flex;
    align-items: baseline;
    gap: 5px;
    font-size: 12px;
    color: var(--c-text);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .item-plus {
    font-size: 11px;
    color: var(--c-midgrey);
    flex-shrink: 0;
    line-height: 1;
  }

  /* System instances */
  .palette-item {
    background: var(--c-darkwhite);
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 5px 8px;
    border-radius: var(--rounded);
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    box-sizing: border-box;
  }
  .palette-item:hover { background: var(--c-lightgrey); }

  /* User instances */
  .palette-row {
    display: flex;
    align-items: center;
    border-radius: var(--rounded);
    background: var(--c-darkwhite);
  }
  .palette-row:hover { background: var(--c-lightgrey); }

  .palette-row-label {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 5px 4px 5px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .palette-row-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.1s;
    flex-shrink: 0;
    padding-right: 4px;
  }
  .palette-row:hover .palette-row-actions,
  .palette-row:focus-within .palette-row-actions { opacity: 1; }

  .action-icon {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    padding: 3px;
    line-height: 0;
    border-radius: var(--rounded);
    display: flex;
    align-items: center;
  }
  .action-icon:hover { color: var(--c-text); background: var(--c-grey); }
  .action-icon.danger:hover { color: var(--c-error); background: var(--c-lightgrey); }

  .palette-rename-input {
    font-size: 12px;
    padding: 4px 8px;
    border: 1px solid var(--c-brand);
    border-radius: var(--rounded);
    background: var(--c-white);
    color: var(--c-text);
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }

  /* Create row + form */
  .create-row {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: var(--c-darkgrey);
    padding: 4px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--rounded);
    width: 100%;
    text-align: left;
    box-sizing: border-box;
  }
  .create-row:hover { color: var(--c-text); background: var(--c-lightgrey); }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--c-darkwhite);
    border: 1px solid var(--c-grey);
    border-radius: var(--rounded);
    padding: 10px 12px;
    margin: 2px 0;
  }

  .create-form-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--c-darkgrey);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .param-row { display: flex; flex-direction: column; }

  .bool-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--c-darkgrey);
    cursor: pointer;
  }

  .windowing-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 2px;
    border-top: 1px solid var(--c-grey);
  }

  .mode-tabs {
    display: flex;
    gap: 2px;
    background: var(--c-grey);
    border-radius: var(--rounded);
    padding: 2px;
  }

  .mode-tab {
    flex: 1;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: var(--c-darkgrey);
    padding: 3px 6px;
    border-radius: calc(var(--rounded) - 1px);
    transition: background 0.1s, color 0.1s;
    text-align: center;
  }
  .mode-tab:hover { color: var(--c-text); }
  .mode-tab.active { background: var(--c-white); color: var(--c-text); font-weight: 500; }

  .window-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .window-row .param-label {
    min-width: 52px;
    flex-shrink: 0;
  }

  .window-input-group {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .window-input {
    width: 64px;
    font-size: 12px;
    padding: 3px 6px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    background: var(--c-white);
    color: var(--c-text);
    outline: none;
    box-sizing: border-box;
  }
  .window-input:focus { border-color: var(--c-brand); }

  .window-unit {
    font-size: 11px;
    color: var(--c-darkgrey);
  }

  .reduction-select {
    font-size: 12px;
    padding: 3px 6px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    background: var(--c-white);
    color: var(--c-text);
    outline: none;
    cursor: pointer;
  }
  .reduction-select:focus { border-color: var(--c-brand); }

  .field-hint {
    font-size: 10px;
    color: var(--c-darkgrey);
    line-height: 1.4;
  }

  .create-label-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .param-label {
    font-size: 11px;
    color: var(--c-darkgrey);
  }

  .label-input {
    font-size: 12px;
    padding: 4px 6px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    background: var(--c-white);
    color: var(--c-text);
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .label-input:focus { border-color: var(--c-brand); }

  .create-footer {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 2px;
  }

  .btn-create {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: var(--c-brand);
    padding: 2px 4px;
  }
  .btn-create:hover { text-decoration: underline; }

  .btn-cancel {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: var(--c-darkgrey);
    padding: 2px 4px;
  }
  .btn-cancel:hover { color: var(--c-text); }
</style>
