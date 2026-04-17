<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck, InputNumber, Radio, Select } from '$lib/shared/components'
  import {
    getStimuliOptions,
    getParticipantOptions,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    RECURRENCE_METHODS,
    RECURRENCE_HIGHLIGHTS,
    RECURRENCE_MASKINGS,
  } from '../const'
  import type {
    RecurrencePlotItem,
    RecurrencePlotSettings,
    RecurrenceHighlight,
    RecurrenceMasking,
  } from '../types'

  interface Props {
    item: RecurrencePlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<RecurrencePlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const participantOptions = $derived(getParticipantOptions(engine))

  const hasSpatial = $derived(engine.capabilities.spatial)
  const availableMethods = $derived(
    hasSpatial
      ? RECURRENCE_METHODS
      : RECURRENCE_METHODS.filter(m => m.value === 'aoi')
  )
  const effectiveMethod = $derived(
    hasSpatial ? settings.recurrenceMethod : 'aoi'
  )
</script>

<PaneSection title="Filters" alwaysOpen>
  <Select
    label="Stimulus"
    options={stimulusOptions}
    value={String(settings.stimulusId)}
    onchange={e => update({ stimulusId: Number((e as CustomEvent).detail) })}
  />
  <Select
    label="Participant"
    options={participantOptions}
    value={String(settings.participantId)}
    onchange={e => update({ participantId: Number((e as CustomEvent).detail) })}
  />
</PaneSection>

<PaneSection title="Method">
  <Radio
    ariaLabel="Recurrence method"
    options={[...availableMethods]}
    appearance="compact"
    direction="row"
    value={effectiveMethod}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as RecurrencePlotSettings['recurrenceMethod']
      update({ recurrenceMethod: v })
    }}
  />
  {#if effectiveMethod === 'fixedDistance'}
    <InputNumber
      id="rec-radius"
      label="Radius [px]"
      value={settings.radius}
      min={1}
      max={500}
      appearance="compact"
      onValueChange={v => update({ radius: v ?? settings.radius })}
    />
  {/if}
  {#if effectiveMethod === 'fixedGrid'}
    <InputNumber
      id="rec-grid-size"
      label="Cells per axis"
      value={settings.gridSize}
      min={2}
      max={100}
      appearance="compact"
      onValueChange={v => update({ gridSize: v ?? settings.gridSize })}
    />
  {/if}
</PaneSection>

<PaneSection title="Presentation">
  <Radio
    legend="Highlight"
    options={[...RECURRENCE_HIGHLIGHTS]}
    appearance="compact"
    value={settings.highlight}
    onchange={e =>
      update({ highlight: (e as CustomEvent<string>).detail as RecurrenceHighlight })}
  />
  <Radio
    legend="Masking"
    options={[...RECURRENCE_MASKINGS]}
    appearance="compact"
    value={settings.masking}
    onchange={e =>
      update({ masking: (e as CustomEvent<string>).detail as RecurrenceMasking })}
  />
</PaneSection>

<PaneSection title="Lines">
  <InputCheck
    label="Duration weighting"
    appearance="compact"
    size="xs"
    checked={settings.showDuration}
    onchange={e => update({ showDuration: (e as CustomEvent<boolean>).detail })}
  />
  <InputNumber
    id="rec-min-line"
    label="Min line length"
    value={settings.minLineLength}
    min={2}
    max={20}
    appearance="compact"
    onValueChange={v => update({ minLineLength: v ?? settings.minLineLength })}
  />
</PaneSection>
