<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck, InputNumber, Radio } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import { RECURRENCE_METHODS } from '../../const'
  import type { RecurrencePlotItem, RecurrencePlotSettings } from '../../types'

  let { item }: { item: RecurrencePlotItem } = $props()
  const { engine } = getGazePlotterSession()
  const bulk = createBulkContext<RecurrencePlotSettings>(() => item)

  const hasSpatial = $derived(engine.capabilities.spatial)
  const availableMethods = $derived(
    hasSpatial
      ? RECURRENCE_METHODS
      : RECURRENCE_METHODS.filter(m => m.value === 'aoi')
  )

  // Effective method couples the stored method with the engine capability — fold
  // that into the accessor so divergence reflects what each plot actually uses.
  const method = $derived(
    bulk.common(s => (hasSpatial ? s.recurrenceMethod : 'aoi'))
  )
  const radius = $derived(bulk.common(s => s.radius))
  const gridSize = $derived(bulk.common(s => s.gridSize))
  const showDuration = $derived(bulk.common(s => s.showDuration))
  const minLineLength = $derived(bulk.common(s => s.minLineLength))

  const methodSummary = $derived(
    method.mixed
      ? 'Mixed'
      : (RECURRENCE_METHODS.find(m => m.value === method.value)?.label ??
        method.value)
  )
</script>

<PaneSection title="Method" summary={methodSummary}>
  <Radio
    ariaLabel="Recurrence method"
    options={[...availableMethods]}
    appearance="compact"
    direction="row"
    value={method.value}
    mixed={method.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as RecurrencePlotSettings['recurrenceMethod']
      bulk.update({ recurrenceMethod: v })
    }}
  />
  {#if !method.mixed && method.value === 'fixedDistance'}
    <InputNumber
      id="rec-radius"
      label="Radius [px]"
      value={radius.value}
      mixed={radius.mixed}
      min={1}
      max={500}
      appearance="compact"
      onValueChange={v => bulk.update({ radius: v ?? radius.value })}
    />
  {/if}
  {#if !method.mixed && method.value === 'fixedGrid'}
    <InputNumber
      id="rec-grid-size"
      label="Cells per axis"
      value={gridSize.value}
      mixed={gridSize.mixed}
      min={2}
      max={100}
      appearance="compact"
      onValueChange={v => bulk.update({ gridSize: v ?? gridSize.value })}
    />
  {/if}
  <InputCheck
    label="Duration weighting"
    appearance="compact"
    size="xs"
    checked={showDuration.value}
    mixed={showDuration.mixed}
    onchange={e => bulk.update({ showDuration: (e as CustomEvent<boolean>).detail })}
  />
  <InputNumber
    id="rec-min-line"
    label="Min line length"
    value={minLineLength.value}
    mixed={minLineLength.mixed}
    min={2}
    max={20}
    appearance="compact"
    onValueChange={v => bulk.update({ minLineLength: v ?? minLineLength.value })}
  />
</PaneSection>
