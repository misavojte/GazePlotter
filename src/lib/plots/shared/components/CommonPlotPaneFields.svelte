<script lang="ts" generics="TType extends PlotType, TSettings extends { stimulusId: number; groupId: number; metricInstanceIds: string[] }">
  /**
   * The "first three fields" every metric-consuming plot pane opens with:
   * stimulus, participant group, and the contract-driven metric selector.
   *
   * Six PaneSettings used to repeat the same 15–20-line preamble (options
   * derivation + command source + update patch) and JSX block before any
   * plot-specific controls. This component captures all of it. Plot-specific
   * sections (overlays, color scales, ordering) stay where they are; the
   * pane simply nests the wrapper at the top of its layout.
   */
  import { Select } from '$lib/shared/components'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '../index'
  import ContractMetricSelect from './ContractMetricSelect.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { PlotItemContract } from '../../definePlot'
  import type { PlotMetricContract } from '$lib/metrics'
  import type { PlotType } from '$lib/workspace'

  interface Props {
    item: PlotItemContract<TType, TSettings>
    /**
     * The plot's `consumesMetrics` contract. When omitted, the metric
     * selector is hidden — non-metric plots can reuse the wrapper for the
     * stimulus + group pair alone (currently unused, but a free extension).
     */
    contract?: PlotMetricContract
    metricLabel?: string
  }

  let { item, contract, metricLabel }: Props = $props()

  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<TSettings>): void {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId),
  )
</script>

<Select
  label="Stimulus"
  options={stimulusOptions}
  value={String(settings.stimulusId)}
  onchange={e =>
    update({ stimulusId: Number((e as CustomEvent).detail) } as Partial<TSettings>)}
/>
<Select
  label="Participant group"
  options={groupOptions}
  value={String(settings.groupId)}
  onchange={e =>
    update({ groupId: Number((e as CustomEvent).detail) } as Partial<TSettings>)}
/>
{#if contract}
  <ContractMetricSelect
    {engine}
    {contract}
    metricInstanceIds={settings.metricInstanceIds}
    onMetricsChange={ids =>
      update({ metricInstanceIds: ids } as Partial<TSettings>)}
    label={metricLabel ?? 'Metric'}
  />
{/if}
