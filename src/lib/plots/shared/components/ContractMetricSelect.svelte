<script lang="ts">
  import {
    MetricSelect,
    type PlotMetricContract,
  } from '$lib/metrics'
  import {
    multiSelectMetricHandlers,
    singleSelectMetricHandlers,
  } from '../metricInstanceHandlers'
  import type { DataEngine } from '$lib/data/engine'

  interface Props {
    /** Data engine; provides the metric library + mutation entry points. */
    engine: DataEngine
    /**
     * Plot contract, normally read from `definition.consumesMetrics`. Drives
     * library filtering AND single- vs multi-select routing via
     * `contract.multiSelect`.
     */
    contract: PlotMetricContract
    /**
     * Current selection from the plot's settings. Singleton plots store
     * length-0 (none) or length-1 (selected) arrays; multi-select plots
     * store N. The shape is uniform on disk regardless of `multiSelect`.
     */
    metricInstanceIds: string[]
    /**
     * Patch the plot's settings with the new selection. Called with the full
     * array (length 0/1 for single-select, length N for multi).
     */
    onMetricsChange: (ids: string[]) => void
    label?: string
    /** Multi-selection "Mixed": the bound plots disagree on the metric. */
    mixed?: boolean
  }

  let {
    engine,
    contract,
    metricInstanceIds,
    onMetricsChange,
    label = 'Metric',
    mixed = false,
  }: Props = $props()

  // Routing single- vs multi-select handlers from `contract.multiSelect` —
  // not from per-plot wiring. The shared `metricInstanceHandlers` factories
  // already encapsulate the engine-mutation patterns (rename / create /
  // delete) so each plot's pane settings drops the metric-select plumbing.
  const handlers = $derived(
    contract.multiSelect
      ? multiSelectMetricHandlers(
          engine,
          () => metricInstanceIds,
          ids => onMetricsChange(ids),
        )
      : singleSelectMetricHandlers(
          engine,
          () => metricInstanceIds[0] ?? null,
          id => onMetricsChange(id == null ? [] : [id]),
        )
  )
</script>

<MetricSelect
  {label}
  {contract}
  {mixed}
  instances={engine.metadata?.metricInstances ?? []}
  selectedIds={metricInstanceIds}
  {...handlers}
/>
