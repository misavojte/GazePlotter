<script lang="ts">
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
  import { getGazePlotterSession } from '$lib/session'
  import { listMetrics } from '$lib/metrics/core/defineMetric'
  import { getCategoryLabels } from '$lib/metrics/categories'
  import {
    metricIsCreatableInContract,
    type PlotMetricContract,
  } from '$lib/metrics/filters'
  import type { Metric } from '$lib/metrics/core/dsl'
  import { configureMetricModal } from './definition-steps'

  interface Props {
    contract: PlotMetricContract
    selectedCategory: string
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
    selectedCategory,
    oncreateInstance,
  }: Props = $props()

  const { modalState } = getGazePlotterSession()

  const METRICS = listMetrics()
  const CATEGORY_LABELS = getCategoryLabels()

  const addableMetrics = $derived(
    METRICS.filter(m => metricIsCreatableInContract(m, contract))
  )

  const categoryMetrics = $derived(
    addableMetrics.filter(m => m.meta.category === selectedCategory)
  )

  const titleText = $derived(
    CATEGORY_LABELS[selectedCategory] ?? 'Select metric'
  )

  function selectMetric(metricId: string) {
    modalState.push(configureMetricModal, {
      contract,
      selectedMetricId: metricId,
      oncreateInstance,
    })
  }

  function goBack() {
    modalState.close()
  }
</script>

<div class="pick-metric-container">
  <div class="add-mode-header">
    <button type="button" class="back-btn" onclick={goBack}>
      <ArrowLeft size={14} />
      <span>Back to categories</span>
    </button>
    <span class="add-mode-title">{titleText}</span>
  </div>

  <div class="metric-select-list">
    {#each categoryMetrics as m}
      <button type="button" class="metric-select-row" onclick={() => selectMetric(m.meta.id)}>
        <div class="metric-select-info">
          <span class="metric-select-name">{m.meta.label}</span>
          <p class="metric-select-desc">{m.meta.description}</p>
        </div>
        <span class="metric-select-action">Configure →</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .pick-metric-container {
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

  .metric-select-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .metric-select-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    background: var(--c-darkwhite);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    outline: none;
  }
  .metric-select-row:hover {
    border-color: var(--c-brand);
    background: var(--c-white);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  }

  .metric-select-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .metric-select-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--c-text);
  }

  .metric-select-desc {
    font-size: 11px;
    color: var(--c-darkgrey);
    margin: 0;
    line-height: 1.4;
  }

  .metric-select-action {
    font-size: 11px;
    font-weight: 500;
    color: var(--c-brand);
    flex-shrink: 0;
    transition: transform 0.15s;
  }
  .metric-select-row:hover .metric-select-action {
    transform: translateX(2px);
  }
</style>
