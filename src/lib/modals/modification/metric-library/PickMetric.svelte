<script lang="ts">
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

  function selectMetric(metricId: string) {
    modalState.push(configureMetricModal, {
      contract,
      selectedMetricId: metricId,
      oncreateInstance,
    })
  }
</script>

<div class="pick-metric-container">

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
    transition: all var(--transition-normal) ease;
    text-align: left;
    outline: none;

    &:hover {
      border-color: var(--c-brand);
      background: var(--c-white);
      box-shadow: var(--shadow);
    }
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
    transition: transform var(--transition-fast);
  }
  .metric-select-row:hover .metric-select-action {
    transform: translateX(2px);
  }
</style>
