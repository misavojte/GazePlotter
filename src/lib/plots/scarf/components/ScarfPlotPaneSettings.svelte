<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck, InputNumber, Radio, Select } from '$lib/shared/components'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { hasEventsForStimulus } from '$lib/data/engine'
  import type {
    ScarfDisplayMode,
    ScarfPlotItem,
    ScarfPlotSettings,
  } from '../types'

  interface Props {
    item: ScarfPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<ScarfPlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  const isOrdinal = $derived(settings.timeline === 'ordinal')
  const isRelative = $derived(settings.timeline === 'relative')
  const stimulusHasEvents = $derived(
    hasEventsForStimulus(engine, settings.stimulusId)
  )
  const stimulusHasSegments = $derived(engine.capabilities.segmented)

  const displayMode = $derived<ScarfDisplayMode>(
    settings.displayMode ?? 'overlay'
  )
  const showDisplayMode = $derived(stimulusHasEvents && !isOrdinal)
  const showHideNonFixations = $derived(
    stimulusHasSegments && (isOrdinal || displayMode !== 'events')
  )

  const rangeTitle = $derived(
    isRelative
      ? 'Time range [ms]'
      : isOrdinal
        ? 'Ordinal range [indices]'
        : 'Time range [ms]'
  )
  const rangeStart = $derived(
    isOrdinal ? settings.ordinalStart : settings.timelineStart
  )
  const rangeEnd = $derived(
    isOrdinal ? settings.ordinalEnd : settings.timelineEnd
  )
  function updateRange(boundary: 'start' | 'end', value: number | undefined) {
    if (isOrdinal) {
      update(
        boundary === 'start' ? { ordinalStart: value } : { ordinalEnd: value }
      )
    } else {
      update(
        boundary === 'start'
          ? { timelineStart: value }
          : { timelineEnd: value }
      )
    }
  }
</script>

<PaneSection>
  <Select
    label="Stimulus"
    options={stimulusOptions}
    value={String(settings.stimulusId)}
    onchange={e => update({ stimulusId: Number((e as CustomEvent).detail) })}
  />
  <Select
    label="Participant group"
    options={groupOptions}
    value={String(settings.groupId)}
    onchange={e => update({ groupId: Number((e as CustomEvent).detail) })}
  />
  <Select
    label="Timeline"
    options={[
      { label: 'Absolute', value: 'absolute' },
      { label: 'Relative', value: 'relative' },
      { label: 'Ordinal', value: 'ordinal' },
    ]}
    value={settings.timeline}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as ScarfPlotSettings['timeline']
      update({ timeline: v })
    }}
  />
  </PaneSection>
  
  {#if !isRelative}
    <PaneSection title={rangeTitle}>
      <div class="inline-pair">
        <InputNumber
          id="scarf-range-start"
          label="Start"
          value={rangeStart}
          min={0}
          appearance="compact"
          allowEmpty={true}
          onValueChange={v => updateRange('start', v)}
        />
        <InputNumber
          id="scarf-range-end"
          label="End (0 = Auto)"
          value={rangeEnd}
          min={0}
          appearance="compact"
          allowEmpty={true}
          onValueChange={v => updateRange('end', v)}
        />
      </div>
    </PaneSection>
  {/if}

{#if showDisplayMode}
  <PaneSection title="Event display">
    <Radio
      ariaLabel="Event display"
      options={[
        { label: 'None', value: 'segments' },
        { label: 'Overlay', value: 'overlay' },
        { label: 'Only events', value: 'events' },
      ]}
      appearance="compact"
      direction="row"
      value={displayMode}
      onchange={e => {
        const v = (e as CustomEvent<string>).detail as ScarfDisplayMode
        update({ displayMode: v })
      }}
    />
  </PaneSection>
{/if}

{#if showHideNonFixations}
  <PaneSection title="Segments">
    <InputCheck
      label="Hide non-fixations"
      appearance="compact"
      size="xs"
      checked={settings.hideNonFixations ?? false}
      onchange={e => update({ hideNonFixations: (e as CustomEvent<boolean>).detail })}
    />
  </PaneSection>
{/if}

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
