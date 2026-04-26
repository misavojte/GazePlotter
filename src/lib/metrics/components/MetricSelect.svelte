<script lang="ts">
  import Settings from 'lucide-svelte/icons/settings'
  import { getGazePlotterSession } from '$lib/session'
  import { metricLibraryModal } from '$lib/modals/definitions'
  import { Select } from '$lib/shared/components'
  import type { SelectOption } from '$lib/shared/components/select'
  import {
    formatParamReadout,
    formatProjectionReadout,
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
  }: Props = $props()

  const { modalState } = getGazePlotterSession()

  /** Instances filtered by the contract descriptor. */
  const visibleInstances = $derived(
    instances.filter(i => instanceMatchesContract(i, contract))
  )

  function readoutOf(inst: MetricInstance): string {
    const params = formatParamReadout(inst)
    const projLine = formatProjectionReadout(inst)
    return [...params, ...(projLine ? [projLine] : [])].join(' · ')
  }

  const options = $derived<SelectOption[]>(
    visibleInstances.map(inst => ({
      label: inst.label,
      value: inst.id,
      detail: readoutOf(inst),
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

  function openLibrary() {
    modalState.open(metricLibraryModal, {
      contract,
      oncreateInstance,
      ondeleteInstance,
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
  multiple={!isSingleSelect}
  topAction={{
    label: 'Edit library…',
    icon: Settings,
    onAction: openLibrary,
  }}
  emptyMessage='No metrics. Click "Edit library…" to add one.'
  onchange={handleChange}
/>
