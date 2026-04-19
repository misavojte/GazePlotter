<script lang="ts">
  import Plus from 'lucide-svelte/icons/plus'
  import X from 'lucide-svelte/icons/x'
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
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
    context?: 'global' | 'windowed'
  }

  let {
    instances,
    selectedIds,
    onchange,
    onrenameInstance,
    oncreateInstance,
    ondeleteInstance,
    context = 'global',
  }: Props = $props()

  let paletteOpen = $state(false)
  let renamingId = $state<number | null>(null)
  let renameDraft = $state('')

  // Create form state
  let creatingBaseId = $state<string | null>(null)
  let paramDraft = $state<Record<string, unknown>>({})
  let labelOverride = $state('')
  let createMode = $state<MetricComputationMode>('global')
  let windowSize = $state(20)
  let windowReduction = $state<WindowingConfig['reduction']>('mean')

  const selectedSet = $derived(new Set(selectedIds))

  function isCreatable(d: (typeof METRIC_DEFS)[number]): boolean {
    if (context === 'windowed') {
      return !!(d.computationModes?.some(m => m !== 'global'))
    }
    return true
  }

  type PaletteGroup = {
    key: string
    label: string
    creatableDefs: (typeof METRIC_DEFS)[number][]
  }

  const paletteGroups = $derived.by<PaletteGroup[]>(() =>
    METRIC_CATEGORY_ORDER
      .map(key => ({
        key,
        label: METRIC_CATEGORY_LABELS[key] ?? key,
        creatableDefs: METRIC_DEFS.filter(d => d.category === key && isCreatable(d)),
      }))
      .filter(g => g.creatableDefs.length > 0)
  )

  const liveLabel = $derived.by(() => {
    if (!creatingBaseId) return ''
    const override = labelOverride.trim()
    return override.length > 0 ? override : defaultInstanceLabel(creatingBaseId, paramDraft)
  })

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

  // --- Add system instance (global context, no-param metrics) ---

  function addSystemInstance(baseId: string) {
    const inst = instances.find(i => i.baseId === baseId && !!i.system)
    if (!inst || selectedSet.has(inst.id)) return
    onchange([...selectedIds, inst.id])
    paletteOpen = false
  }

  // --- Create form ---

  function openCreate(baseId: string) {
    creatingBaseId = baseId
    const def = getMetricDef(baseId)
    paramDraft = Object.fromEntries((def?.params ?? []).map(p => [p.id, p.default]))
    labelOverride = ''
    createMode = context === 'windowed' ? 'epoch' : 'global'
    windowSize = def?.category === 'rqa-aoi' ? 20 : 2000
    windowReduction = 'mean'
  }

  function cancelCreate() {
    creatingBaseId = null
    paramDraft = {}
    labelOverride = ''
    createMode = context === 'windowed' ? 'epoch' : 'global'
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
    <!-- Instance list with radio (windowed) or checkbox (global) selection -->
    {#if instances.length === 0}
      <div class="empty">No metrics yet.</div>
    {:else}
      <ul class="instances-list">
        {#each instances as inst (inst.id)}
          {@const readout = formatParamReadout(inst)}
          {@const winLine = formatWindowingReadout(inst)}
          <li class="instance-item">
            {#if context === 'windowed'}
              <input
                type="radio"
                name="ev-metric"
                checked={selectedSet.has(inst.id)}
                onchange={() => onchange([inst.id])}
                aria-label={inst.label}
              />
            {:else}
              <input
                type="checkbox"
                checked={selectedSet.has(inst.id)}
                onchange={() => {
                  if (selectedSet.has(inst.id)) onchange(selectedIds.filter(x => x !== inst.id))
                  else onchange([...selectedIds, inst.id])
                }}
                aria-label={inst.label}
              />
            {/if}
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
            {#if inst.id >= 1000 && ondeleteInstance}
              <button
                type="button"
                class="remove"
                onclick={() => ondeleteInstance?.(inst.id)}
                aria-label="Delete from library"
              >
                <X size={12} />
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <div class="picker-footer">
      {#if oncreateInstance}
        <button class="add" type="button" onclick={() => (paletteOpen = true)}>
          <Plus size={12} /> New variant…
        </button>
      {/if}
    </div>
  {:else}
    <!-- Palette: only creation / quick-add buttons, no instance list -->
    <div class="palette-header">
      <button
        type="button"
        class="back"
        onclick={() => { paletteOpen = false; cancelCreate() }}
        aria-label="Back to selected metrics"
      >
        <ArrowLeft size={12} />
      </button>
    </div>

    {#if paletteGroups.length === 0}
      <div class="empty">No metrics available.</div>
    {:else}
      <div class="palette-list">
        {#each paletteGroups as group (group.key)}
          <div class="group">
            <div class="group-label">{group.label}</div>

            {#each group.creatableDefs as def (def.id)}
              {#if creatingBaseId === def.id}
                {@const availableModes = context === 'windowed'
                  ? (def.computationModes ?? []).filter(m => m !== 'global')
                  : []}
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
                  {#if availableModes.length > 0}
                    <div class="windowing-section">
                      {#if availableModes.length > 1}
                        <div class="param-label">Computation</div>
                        <div class="mode-tabs">
                          {#each availableModes as mode}
                            <button
                              type="button"
                              class="mode-tab"
                              class:active={createMode === mode}
                              onclick={() => { createMode = mode }}
                            >
                              {mode === 'epoch' ? 'Epoch' : 'Sliding'}
                            </button>
                          {/each}
                        </div>
                      {/if}
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
              {:else if context === 'global' && !(def.params?.length)}
                {@const sysInst = instances.find(i => i.baseId === def.id && !!i.system)}
                {#if sysInst && !selectedSet.has(sysInst.id)}
                  <button
                    type="button"
                    class="create-row"
                    onclick={() => addSystemInstance(def.id)}
                  >
                    <Plus size={11} /> {def.label}
                  </button>
                {/if}
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

  /* ── Instance list ── */

  .instances-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 240px;
    overflow-y: auto;
  }

  .instance-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 6px;
    align-items: start;
    padding: 5px 8px;
    border-radius: var(--rounded);
    background: var(--c-lightgrey);
  }

  .instance-item input[type='radio'],
  .instance-item input[type='checkbox'] {
    margin-top: 2px;
    flex-shrink: 0;
    cursor: pointer;
  }

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
