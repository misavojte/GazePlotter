<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck, Select } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { hasEventsForStimulus } from '$lib/data/engine'
  import {
    AoiPaneSection,
    EventPaneSection,
    StimulusPaneSection,
    ParticipantGroupPaneSection,
    TimelineRangeSection,
    EyeMovementTypePaneSection,
  } from '$lib/plots/shared/components'
  import type {
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

  const isOrdinal = $derived(settings.timeline === 'ordinal')
  const isRelative = $derived(settings.timeline === 'relative')
  const stimulusHasEvents = $derived(
    hasEventsForStimulus(engine, settings.stimulusId)
  )
  const stimulusHasSegments = $derived(engine.capabilities.segmented)

  // Events ride as an overlay on the gaze segments; not shown in the
  // segment-index-based ordinal view.
  const showHideEvents = $derived(stimulusHasEvents && !isOrdinal)
  const showHideNonFixations = $derived(stimulusHasSegments)

  // Ordinal range title override for the shared TimelineRangeSection
  const rangeTitle = $derived(
    isRelative
      ? 'Time range [ms]'
      : isOrdinal
        ? 'Ordinal range [indices]'
        : 'Time range [ms]'
  )

  function handleOrdinalChange(boundary: 'start' | 'end', value: number | undefined) {
    update(
      boundary === 'start' ? { ordinalStart: value } : { ordinalEnd: value }
    )
  }
  const timelineSummary = $derived(
    settings.timeline ? settings.timeline.charAt(0).toUpperCase() + settings.timeline.slice(1) : ''
  )
</script>

<StimulusPaneSection
  stimulusId={settings.stimulusId}
  onchange={id => update({ stimulusId: id })}
  {source}
/>

<ParticipantGroupPaneSection
  groupId={settings.groupId}
  stimulusId={settings.stimulusId}
  onchange={id => update({ groupId: id })}
  {source}
/>

<PaneSection title="Visualisation" summary={timelineSummary}>
  <div class="sub-group">
    <div class="legend">Timeline mode</div>
    <Select
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
  </div>

  {#if showHideNonFixations || showHideEvents}
    <div class="sub-group">
      <div class="legend">Hide data</div>
      {#if showHideNonFixations}
        <InputCheck
          label="Non-fixations"
          appearance="compact"
          size="xs"
          checked={settings.hideNonFixations ?? false}
          onchange={e => update({ hideNonFixations: (e as CustomEvent<boolean>).detail })}
        />
      {/if}
      {#if showHideEvents}
        <InputCheck
          label="Events"
          appearance="compact"
          size="xs"
          checked={settings.hideEvents ?? false}
          onchange={e => update({ hideEvents: (e as CustomEvent<boolean>).detail })}
        />
      {/if}
    </div>
  {/if}
</PaneSection>

<TimelineRangeSection
  {item}
  title={rangeTitle}
  ordinal={isOrdinal}
  ordinalStart={settings.ordinalStart}
  ordinalEnd={settings.ordinalEnd}
  onOrdinalChange={handleOrdinalChange}
/>

<AoiPaneSection stimulusId={settings.stimulusId} {source} />

<EyeMovementTypePaneSection {source} />

<EventPaneSection stimulusId={settings.stimulusId} {source} />

<style>
  .sub-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin-top: 4px;
  }

  .sub-group:first-of-type {
    margin-top: 0;
  }

  .sub-group .legend {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
</style>
