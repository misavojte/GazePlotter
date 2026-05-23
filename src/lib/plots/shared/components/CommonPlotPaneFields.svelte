<script lang="ts" generics="TType extends PlotType, TSettings extends { stimulusId: number; groupId: number; metricInstanceIds: string[] }">
  /**
   * The "first three fields" every metric-consuming plot pane opens with:
   * stimulus, participant group, and the contract-driven metric selector.
   *
   * Each picker lives in its own collapsible `PaneSection` so the pane reads
   * as a single column of sections — heading + current-value summary —
   * matching the rest of the pane's visual language. Each section also
   * carries the inline "Edit X library…" affordance for the global editor
   * that's contextually relevant to the picker above it.
   */
  import { Select } from '$lib/shared/components'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '../index'
  import ContractMetricSelect from './ContractMetricSelect.svelte'
  import { PaneSection, PaneEditLink, PaneEditRow } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    aoiModificationModal,
    metricLibraryModal,
    participantModificationModal,
    participantsGroupsModal,
    stimulusModificationModal,
  } from '$lib/modals/definitions'
  import {
    multiSelectMetricHandlers,
    singleSelectMetricHandlers,
  } from '../metricInstanceHandlers'
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

  const { engine, modalState, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<TSettings>): void {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId),
  )

  const stimulusSummary = $derived(
    stimulusOptions.find(o => o.value === String(settings.stimulusId))?.label ?? '',
  )
  const groupSummary = $derived(
    groupOptions.find(o => o.value === String(settings.groupId))?.label ?? '',
  )

  function openStimuli() {
    modalState.open(stimulusModificationModal, { source })
  }
  function openAois() {
    modalState.open(aoiModificationModal, {
      selectedStimulus: String(settings.stimulusId),
      source,
    })
  }
  function openGroups() {
    modalState.open(participantsGroupsModal, { source })
  }
  function openParticipants() {
    modalState.open(participantModificationModal, { source })
  }

  const metricSummary = $derived.by(() => {
    const lib = engine.metadata?.metricInstances ?? []
    const picked = settings.metricInstanceIds
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
          () => settings.metricInstanceIds,
          ids => update({ metricInstanceIds: ids } as Partial<TSettings>),
        )
      : singleSelectMetricHandlers(
          engine,
          () => settings.metricInstanceIds[0] ?? null,
          id =>
            update({
              metricInstanceIds: id == null ? [] : [id],
            } as Partial<TSettings>),
        )
    modalState.open(metricLibraryModal, { contract, ...handlers })
  }
</script>

<PaneSection title="Stimulus" summary={stimulusSummary} defaultOpen>
  <Select
    options={stimulusOptions}
    value={String(settings.stimulusId)}
    onchange={e =>
      update({ stimulusId: Number((e as CustomEvent).detail) } as Partial<TSettings>)}
  />
  <PaneEditRow>
    <PaneEditLink onclick={openStimuli}>Edit stimulus library…</PaneEditLink>
    <PaneEditLink onclick={openAois}>Edit AOIs…</PaneEditLink>
  </PaneEditRow>
</PaneSection>

<PaneSection title="Participant group" summary={groupSummary}>
  <Select
    options={groupOptions}
    value={String(settings.groupId)}
    onchange={e =>
      update({ groupId: Number((e as CustomEvent).detail) } as Partial<TSettings>)}
  />
  <PaneEditRow>
    <PaneEditLink onclick={openGroups}>Edit groups…</PaneEditLink>
    <PaneEditLink onclick={openParticipants}>Edit participants…</PaneEditLink>
  </PaneEditRow>
</PaneSection>

{#if contract}
  <PaneSection title={metricLabel ?? 'Metric'} summary={metricSummary}>
    <ContractMetricSelect
      {engine}
      {contract}
      metricInstanceIds={settings.metricInstanceIds}
      onMetricsChange={ids =>
        update({ metricInstanceIds: ids } as Partial<TSettings>)}
      label=""
    />
    <PaneEditLink onclick={openMetricLibrary}>Edit metric library…</PaneEditLink>
  </PaneSection>
{/if}
