<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { listMetrics } from '$lib/metrics/core/defineMetric'
  import { listCategories } from '$lib/metrics/categories'
  import {
    metricIsCreatableInContract,
    type PlotMetricContract,
  } from '$lib/metrics/filters'
  import type { Metric } from '$lib/metrics/core/dsl'
  import { InputText } from '$lib/shared/components'
  import MetricPickCard from './MetricPickCard.svelte'
  import { configureMetricModal } from './definition-steps'

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

  let { contract, oncreateInstance }: Props = $props()

  const { modalState } = getGazePlotterSession()

  const METRICS = listMetrics()
  // Category registry (ordered) is the single source for section order + labels.
  const CATEGORIES = listCategories()

  const addable = $derived(METRICS.filter(m => metricIsCreatableInContract(m, contract)))

  // Search appears once the list is long enough to warrant it.
  const SEARCHABLE_FROM = 8
  let query = $state('')
  const searchable = $derived(addable.length >= SEARCHABLE_FROM)
  const normalizedQuery = $derived(query.trim().toLowerCase())
  const isFiltering = $derived(searchable && normalizedQuery.length > 0)

  function matches(m: Metric): boolean {
    if (!isFiltering) return true
    return (
      m.meta.label.toLowerCase().includes(normalizedQuery) ||
      m.meta.description.toLowerCase().includes(normalizedQuery) ||
      m.meta.searchTags.some(t => t.toLowerCase().includes(normalizedQuery))
    )
  }

  // Metrics grouped by category, in registry order; empty categories drop out.
  const groups = $derived.by(() => {
    const shown = addable.filter(matches)
    return CATEGORIES.map(c => ({
      id: c.id,
      label: c.label,
      metrics: shown.filter(m => m.meta.category === c.id),
    })).filter(g => g.metrics.length > 0)
  })

  // Category headers only earn their keep when there's more than one section.
  const showCategoryHeaders = $derived(groups.length > 1)

  function selectMetric(metricId: string) {
    modalState.push(configureMetricModal, {
      contract,
      selectedMetricId: metricId,
      oncreateInstance,
    })
  }
</script>

<div class="pick-metric-container">
  {#if searchable}
    <InputText
      label="Search metrics"
      showLabel={false}
      ariaLabel="Search metrics"
      placeholder="Search metrics"
      bind:value={query}
      fill
    />
  {/if}

  {#if groups.length === 0}
    <p class="empty">No metrics match “{query}”.</p>
  {:else}
    {#each groups as group (group.id)}
      <div class="cat-group">
        {#if showCategoryHeaders}
          <div class="cat-title">{group.label}</div>
        {/if}
        <div class="cat-metrics">
          {#each group.metrics as m (m.meta.id)}
            <MetricPickCard
              title={m.meta.label}
              description={m.meta.description}
              onclick={() => selectMetric(m.meta.id)}
            />
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .pick-metric-container {
    display: flex;
    flex-direction: column;
    width: min(560px, calc(100vw - 4rem));
    gap: 16px;
  }

  .cat-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cat-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-darkgrey);
  }

  .cat-metrics {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty {
    font-size: 12px;
    color: var(--c-darkgrey);
    text-align: center;
    padding: 12px 0;
    margin: 0;
  }
</style>
