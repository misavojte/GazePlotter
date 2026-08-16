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
  import { listMetrics } from '$lib/metrics/core/defineMetric'
  import {
    instanceDetailLine,
    resolveInstance,
    type MetricInstance,
  } from '$lib/metrics/instances'
  import {
    instanceMatchesContract,
    metricIsCreatableInContract,
    type PlotMetricContract,
  } from '$lib/metrics/filters'
  import type { Projection } from '$lib/metrics'
  import type { CreateInstanceHandler } from '$lib/plots/shared/metricInstanceHandlers'
  import { pickMetricModal, configureMetricModal } from './definition-steps'

  interface Props {
    contract: PlotMetricContract
    editMetricId?: string
    oncreateInstance?: CreateInstanceHandler
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

  const { engine, workspace, modalState } = getGazePlotterSession()

  // The metrics this plot can consume, in library order. Each row's own label and
  // detail line carry what it measures and how it's projected — the list is a flat
  // roster keyed by what the researcher named, not by the shape of the output.
  const instances = $derived(
    (engine.metadata?.metricInstances ?? []).filter(i =>
      instanceMatchesContract(i, contract, engine.capabilities),
    ),
  )

  const addableMetrics = $derived.by(() => {
    const allBaseMetrics = listMetrics()
    return allBaseMetrics.filter(m =>
      metricIsCreatableInContract(m, contract, engine.capabilities),
    )
  })

  // ── Drag reorder ─────────────────────────────────────────
  // Indices are list-local (the shown, contract-matched rows); the moved order is
  // written back into the matching slots of the global instances array, leaving
  // instances for other contracts untouched.
  let dragItemId = $state<string | null>(null)
  const dragHandle = createListReorder<string>({
    itemSelector: '.metric-card',
    containerSelector: '.metric-grid',
    onDragStart: id => { dragItemId = id },
    onDragEnd: () => { dragItemId = null },
    onReorder: (from, to) => {
      const all = [...(engine.metadata?.metricInstances ?? [])]
      const indices = all.reduce<number[]>((acc, inst, i) => {
        if (instanceMatchesContract(inst, contract, engine.capabilities)) acc.push(i)
        return acc
      }, [])
      const fromGlobal = indices[from]
      const toGlobal = indices[to]
      const [item] = all.splice(fromGlobal, 1)
      all.splice(toGlobal, 0, item)
      workspace.apply({
        type: 'updateMetricInstances',
        instances: all,
        source: 'metricLibrary.reorder',
      })
    },
  })

  function openAddModal() {
    modalState.push(pickMetricModal, {
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
  {#if instances.length > 0}
    <div class="metric-grid">
      {#each instances as inst (inst.id)}
        {@const detail = instanceDetailLine(inst)}
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
    transition: border-color var(--transition-fast), background var(--transition-fast);

    &:hover {
      border-color: var(--c-midgrey);
      background: var(--c-white);
    }

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
