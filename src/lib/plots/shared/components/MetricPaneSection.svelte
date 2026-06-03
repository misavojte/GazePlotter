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
  }

  let {
    item,
    metricInstanceIds,
    onchange,
    label = 'Metric',
  }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  const contract = $derived(resolvePlotDefinition(item.type).consumesMetrics!)

  const metricSummary = $derived.by(() => {
    const lib = engine.metadata?.metricInstances ?? []
    const picked = metricInstanceIds
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
          () => metricInstanceIds,
          ids => {
            onchange(ids)
          }
        )
      : singleSelectMetricHandlers(
          engine,
          () => metricInstanceIds[0] ?? null,
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
      {metricInstanceIds}
      onMetricsChange={ids => {
        onchange(ids)
      }}
      label=""
    />
    <PaneEditLink onclick={openMetricLibrary}>Edit metric library…</PaneEditLink>
  </PaneSection>
{/if}
