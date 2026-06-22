<script lang="ts">
  import { PaneSection, PaneEditLink } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import { resolvePlotDefinition } from '$lib/plots/registry'
  import ContractMetricSelect from './ContractMetricSelect.svelte'
  import {
    multiSelectMetricHandlers,
    singleSelectMetricHandlers,
  } from '$lib/plots/shared/metricInstanceHandlers'
  import { metricLibraryModal } from '$lib/modals/definitions'

  interface Props {
    item: { type: string }
    metricInstanceIds: string[]
    onchange: (ids: string[]) => void
    label?: string
    /** Multi-selection "Mixed": the selected plots disagree on the metric.
     *  Shows an empty picker flagged "Mixed"; picking a metric applies to all. */
    mixed?: boolean
  }

  let {
    item,
    metricInstanceIds,
    onchange,
    label = 'Metric',
    mixed = false,
  }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  const contract = $derived(resolvePlotDefinition(item.type).consumesMetrics!)

  // When mixed, treat as an empty selection for the picker and flag it in the
  // summary; picking a metric applies it to all.
  const safeIds = $derived(mixed ? [] : metricInstanceIds)

  const metricSummary = $derived.by(() => {
    if (mixed) return 'Mixed (varies)'
    const lib = engine.metadata?.metricInstances ?? []
    const picked = safeIds
      .map(id => lib.find(i => i.id === id))
      .filter((x): x is (typeof lib)[number] => !!x)
    if (picked.length === 0) return ''
    if (picked.length === 1) return picked[0].label
    return `${picked[0].label} + ${picked.length - 1}`
  })

  function openMetricLibrary() {
    if (!contract) return
    const handlers = contract.multiSelect
      ? multiSelectMetricHandlers(
          engine,
          () => safeIds,
          ids => {
            onchange(ids)
          }
        )
      : singleSelectMetricHandlers(
          engine,
          () => safeIds[0] ?? null,
          id => {
            onchange(id == null ? [] : [id])
          }
        )
    modalState.open(metricLibraryModal, { contract, ...handlers })
  }
</script>

{#if contract}
  <PaneSection title={label} summary={metricSummary}>
    <ContractMetricSelect
      {engine}
      {contract}
      {mixed}
      metricInstanceIds={safeIds}
      onMetricsChange={ids => {
        onchange(ids)
      }}
      label=""
    />
    <PaneEditLink onclick={openMetricLibrary}>Edit metric library…</PaneEditLink>
  </PaneSection>
{/if}
