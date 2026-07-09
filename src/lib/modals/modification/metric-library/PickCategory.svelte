<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { listMetrics } from '$lib/metrics/core/defineMetric'
  import { listCategories } from '$lib/metrics/categories'
  import {
    metricIsCreatableInContract,
    type PlotMetricContract,
  } from '$lib/metrics/filters'
  import type { Metric } from '$lib/metrics/core/dsl'
  import { pickMetricModal } from './definition-steps'

  interface Props {
    contract: PlotMetricContract
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      projection: any,
      replacingId?: string,
    ) => void
  }

  let {
    contract,
    oncreateInstance,
  }: Props = $props()

  const { modalState } = getGazePlotterSession()

  const METRICS = listMetrics()
  // Single source of truth: the metric category registry (ordered).
  const CATEGORIES = listCategories()

  const addableMetrics = $derived(
    METRICS.filter(m => metricIsCreatableInContract(m, contract))
  )

  const activeCategories = $derived.by(() => {
    const cats = new Set<string>()
    for (const m of addableMetrics) {
      cats.add(m.meta.category)
    }
    return CATEGORIES.filter(c => cats.has(c.id))
  })

  function metricsInCategory(catId: string): Metric[] {
    return addableMetrics.filter(m => m.meta.category === catId)
  }

  function selectCategory(catId: string) {
    modalState.push(pickMetricModal, {
      contract,
      selectedCategory: catId,
      oncreateInstance,
    })
  }


</script>

<div class="pick-category-container">

  <div class="theme-grid">
    {#each activeCategories as cat}
      <button type="button" class="theme-card" onclick={() => selectCategory(cat.id)}>
        <div class="theme-card-icon">
          <span class="theme-initial">{cat.label[0]}</span>
        </div>
        <div class="theme-card-body">
          <span class="theme-card-title">{cat.label}</span>
          <span class="theme-card-count">
            {metricsInCategory(cat.id).length} {metricsInCategory(cat.id).length === 1 ? 'metric' : 'metrics'} available
          </span>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .pick-category-container {
    display: flex;
    flex-direction: column;
    width: min(560px, calc(100vw - 4rem));
    gap: 12px;
  }



  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
    margin-top: 4px;
  }

  .theme-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    background: var(--c-darkwhite);
    cursor: pointer;
    transition: all var(--transition-normal) ease;
    text-align: left;
    outline: none;

    &:hover {
      border-color: var(--c-brand);
      background: var(--c-white);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
  }

  .theme-card-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--c-brand) 8%, var(--c-white));
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-brand);
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
  }

  .theme-initial {
    text-transform: uppercase;
  }

  .theme-card-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .theme-card-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--c-text);
  }

  .theme-card-count {
    font-size: 11px;
    color: var(--c-darkgrey);
  }
</style>
