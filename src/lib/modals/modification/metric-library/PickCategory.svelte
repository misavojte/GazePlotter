<script lang="ts">
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
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

  function goBack() {
    modalState.close()
  }
</script>

<div class="pick-category-container">
  <div class="add-mode-header">
    <button type="button" class="back-btn" onclick={goBack}>
      <ArrowLeft size={14} />
      <span>Back to library</span>
    </button>
    <span class="add-mode-title">Select metric category</span>
  </div>

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

  .add-mode-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--c-border);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: var(--c-darkgrey);
    padding: 4px 8px;
    border-radius: var(--rounded-md);
    transition: background 0.1s, color 0.1s;
  }
  .back-btn:hover {
    background: var(--c-lightgrey);
    color: var(--c-text);
  }

  .add-mode-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--c-text);
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
    transition: all 0.15s ease;
    text-align: left;
    outline: none;
  }
  .theme-card:hover {
    border-color: var(--c-brand);
    background: var(--c-white);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
    transform: translateY(-1px);
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
