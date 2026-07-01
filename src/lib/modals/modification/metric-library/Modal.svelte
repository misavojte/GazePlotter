<script lang="ts">
  import { untrack } from 'svelte'
  import { flip } from 'svelte/animate'
  import { cubicOut } from 'svelte/easing'
  import Copy from 'lucide-svelte/icons/copy'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import Pencil from 'lucide-svelte/icons/pencil'
  import X from 'lucide-svelte/icons/x'
  import Plus from 'lucide-svelte/icons/plus'
  import { createListReorder } from '../shared/listReorder.action'
  import { getGazePlotterSession } from '$lib/session'
  import { getMetric, listMetrics } from '$lib/metrics/core/defineMetric'
  import {
    instanceReadout,
    formatProjectionReadout,
    resolveInstance,
    type MetricInstance,
  } from '$lib/metrics/instances'
  import {
    instanceMatchesContract,
    metricIsCreatableInContract,
    type PlotMetricContract,
  } from '$lib/metrics/filters'
  import type { Metric } from '$lib/metrics/core/dsl'
  import type { Projection } from '$lib/metrics/core/projection'
  import { pickCategoryModal, configureMetricModal } from './definition-steps'

  interface Props {
    contract: PlotMetricContract
    editMetricId?: string
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      projection: Projection,
      replacingId?: string,
    ) => void
    ondeleteInstance?: (id: string) => void
    onrenameInstance?: (id: string, label: string) => void
  }

  let {
    contract,
    editMetricId,
    oncreateInstance,
    ondeleteInstance,
    onrenameInstance,
  }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  const METRICS = engine.metadata?.metricInstances ?? []
  const instances = $derived(
    (engine.metadata?.metricInstances ?? []).filter(i => instanceMatchesContract(i, contract)),
  )

  const addableMetrics = $derived.by(() => {
    // Obtain list of all possible base metric definitions in system
    // To check if there are any creatable ones
    const allBaseMetrics = resolveAllBaseMetrics()
    return allBaseMetrics.filter(m => metricIsCreatableInContract(m, contract))
  })

  function resolveAllBaseMetrics(): Metric[] {
    return listMetrics()
  }

  // ── Drag reorder ─────────────────────────────────────────
  let dragItemId = $state<string | null>(null)
  const dragHandle = createListReorder<string>({
    itemSelector: '.metric-card',
    containerSelector: '.metric-grid',
    onDragStart: id => { dragItemId = id },
    onDragEnd: () => { dragItemId = null },
    onReorder: (from, to) => {
      const all = [...(engine.metadata?.metricInstances ?? [])]
      const indices = all.reduce<number[]>((acc, inst, i) => {
        if (instanceMatchesContract(inst, contract)) acc.push(i)
        return acc
      }, [])
      const fromGlobal = indices[from]
      const toGlobal = indices[to]
      const [item] = all.splice(fromGlobal, 1)
      all.splice(toGlobal, 0, item)
      engine.setMetricInstances(all)
    },
  })

  function openAddModal() {
    modalState.push(pickCategoryModal, {
      contract,
      oncreateInstance,
    })
  }

  function openEditModal(inst: MetricInstance) {
    modalState.push(configureMetricModal, {
      contract,
      editMetricId: inst.id,
      oncreateInstance,
      onrenameInstance,
    })
  }

  function duplicateInstance(inst: MetricInstance) {
    const params = { ...inst.params }
    const projection: Projection = JSON.parse(JSON.stringify(inst.projection))
    const label = `${inst.label} (copy)`
    
    modalState.push(configureMetricModal, {
      contract,
      selectedMetricId: inst.baseId,
      initialParams: params,
      initialProjection: projection,
      initialLabel: label,
      initialReduction: inst.reduction,
      oncreateInstance,
    })
  }

  // Auto-expand the requested metric for editing on mount.
  $effect(() => {
    if (!editMetricId) return
    untrack(() => {
      const inst = resolveInstance(engine.metadata?.metricInstances ?? [], editMetricId)
      if (inst) openEditModal(inst)
    })
  })
</script>

<div class="library-modal">
  <div class="section-label">Library</div>

  {#if instances.length > 0}
    <div class="metric-grid">
      {#each instances as inst (inst.id)}
        {@const metric = getMetric(inst.baseId)}
        {@const unit = metric?.meta.unit ?? ''}
        {@const readout = instanceReadout(inst)}
        {@const projLine = formatProjectionReadout(inst)}
        {@const showProjLine = projLine && !inst.label.includes(projLine) ? projLine : null}
        {@const detail = [unit, ...readout, showProjLine].filter(Boolean).join(' · ')}
        <div
          class="metric-card"
          class:dragging={dragItemId === inst.id}
          animate:flip={{ duration: dragItemId === inst.id ? 0 : 150, easing: cubicOut }}
        >
          <div class="card-row">
            <div class="drag-handle" use:dragHandle={inst.id}>
              <GripVertical size={14} />
            </div>
            <div class="card-body">
              <span class="card-name">{inst.label}</span>
              {#if detail}<span class="card-detail">{detail}</span>{/if}
            </div>
            <button
              class="icon-btn"
              onclick={() => openEditModal(inst)}
              title="Edit"
              aria-label="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              class="icon-btn"
              onclick={() => duplicateInstance(inst)}
              title="Duplicate"
              aria-label="Duplicate"
            >
              <Copy size={13} />
            </button>
            <button
              class="icon-btn"
              onclick={() => ondeleteInstance?.(inst.id)}
              title="Delete"
              aria-label="Delete"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="empty">No metrics in library yet.</p>
  {/if}

  {#if addableMetrics.length > 0}
    <button class="add-metric-button" onclick={openAddModal} style:margin-top="16px">
      <Plus size={14} />
      <span>Add new metric</span>
    </button>
  {/if}
</div>

<style>
  .library-modal {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: min(560px, calc(100vw - 4rem));
  }

  .section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-darkgrey);
    margin-bottom: 8px;
  }

  .empty {
    font-size: 12px;
    color: var(--c-darkgrey);
    padding: 10px 0;
    margin: 0;
    text-align: center;
  }

  .metric-grid { display: flex; flex-direction: column; gap: var(--spacing-xs); }

  .metric-card {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    box-shadow: var(--shadow-sm);
    background: var(--c-darkwhite);
    overflow: hidden;

    &.dragging {
      opacity: 0.3;
      border-style: dashed;
      border-color: var(--c-midgrey);
      box-shadow: none;
    }
  }

  .card-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 8px 10px 8px 6px;
  }
  .drag-handle {
    cursor: grab;
    color: var(--c-midgrey);
    display: flex;
    align-items: center;
    padding: 2px;
    flex-shrink: 0;
    transition: color var(--transition-fast);
  }
  .drag-handle:hover { color: var(--c-darkgrey); }
  .drag-handle:active { cursor: grabbing; }

  .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .card-name {
    font-size: 13px;
    color: var(--c-text);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-detail {
    font-size: 11px;
    color: var(--c-darkgrey);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    padding: 4px;
    line-height: 0;
    border-radius: var(--rounded);
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: color var(--transition-fast), background var(--transition-fast);
  }
  .icon-btn:hover { background: var(--c-lightgrey); color: var(--c-text); }

  .add-metric-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    width: 100%;
    padding: 12px 14px;
    border: 1px dashed var(--c-midgrey);
    border-radius: var(--rounded-md);
    background: none;
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all var(--transition-normal) ease;
  }
  .add-metric-button:hover {
    border-color: var(--c-brand);
    color: var(--c-brand);
    background-color: color-mix(in srgb, var(--c-brand) 3%, transparent);
  }
</style>
