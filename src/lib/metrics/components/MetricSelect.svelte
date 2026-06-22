<script lang="ts">
  import Pencil from 'lucide-svelte/icons/pencil'
  import { getGazePlotterSession } from '$lib/session'
  import { configureMetricModal } from '$lib/modals/modification/metric-library/definition-steps'
  import { Select } from '$lib/shared/components'
  import type { SelectOption } from '$lib/shared/components/select'
  import {
    instanceReadout,
    formatProjectionReadout,
    getMetric,
    instanceMatchesContract,
    type MetricInstance,
    type Projection,
    type PlotMetricContract,
  } from '$lib/metrics'

  interface Props {
    /** Raw instance library. MetricSelect filters by `contract` internally. */
    instances: readonly MetricInstance[]
    selectedIds: string[]
    onchange: (ids: string[]) => void
    onrenameInstance?: (id: string, label: string) => void
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      projection: Projection,
      replacingId?: string,
    ) => void
    ondeleteInstance?: (id: string) => void
    /** Descriptor of which leaves/windowing this consumer accepts and whether
     *  selection is multi- or single-valued. */
    contract: PlotMetricContract
    label?: string
    /** Multi-selection "Mixed": the bound plots disagree on the metric. */
    mixed?: boolean
  }

  let {
    instances,
    selectedIds,
    onchange,
    onrenameInstance,
    oncreateInstance,
    ondeleteInstance,
    contract,
    label,
    mixed = false,
  }: Props = $props()

  const { modalState } = getGazePlotterSession()

  /** Instances filtered by the contract descriptor. */
  const visibleInstances = $derived(
    instances.filter(i => instanceMatchesContract(i, contract))
  )

  function readoutOf(inst: MetricInstance): string {
    const unit = getMetric(inst.baseId)?.meta.unit ?? ''
    const params = instanceReadout(inst)
    const projLine = formatProjectionReadout(inst)
    const filteredProjLine = projLine && !inst.label.includes(projLine) ? projLine : null
    return [unit, ...params, filteredProjLine].filter(Boolean).join(' · ')
  }

  const options = $derived<SelectOption[]>(
    visibleInstances.map(inst => ({
      label: inst.label,
      value: inst.id,
      detail: readoutOf(inst),
      secondaryAction: {
        icon: Pencil,
        label: `Edit ${inst.label}`,
        onAction: () => openLibraryEditing(inst.id),
      },
    }))
  )

  const isSingleSelect = $derived(!contract.multiSelect)

  const value = $derived<string | string[]>(
    isSingleSelect ? (selectedIds[0] ?? '') : selectedIds
  )

  const subLabel = $derived.by(() => {
    if (!isSingleSelect) return undefined
    const sel = visibleInstances.find(i => selectedIds.includes(i.id))
    if (!sel) return undefined
    const detail = readoutOf(sel)
    return detail ? `Parameters: ${detail}` : undefined
  })

  const placeholder = $derived(
    isSingleSelect ? 'Choose metric…' : 'No metrics selected'
  )

  function handleChange(e: CustomEvent<string | string[]>) {
    const detail = e.detail
    if (Array.isArray(detail)) {
      onchange(detail)
    } else {
      onchange(detail ? [detail] : [])
    }
  }

  function openLibraryEditing(metricId: string) {
    modalState.open(configureMetricModal, {
      contract,
      editMetricId: metricId,
      oncreateInstance,
      onrenameInstance,
    })
  }
</script>

<Select
  {label}
  {options}
  {value}
  {subLabel}
  {placeholder}
  {mixed}
  multiple={!isSingleSelect}
  emptyMessage="No metrics yet."
  onchange={handleChange}
/>
