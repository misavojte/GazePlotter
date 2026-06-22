<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck, Select } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import { hasEventsForStimulus } from '$lib/data/engine'
  import type { ScarfPlotItem, ScarfPlotSettings } from '../../types'

  let { item }: { item: ScarfPlotItem } = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const bulk = createBulkContext<ScarfPlotSettings>(() => item)

  const timeline = $derived(bulk.common(s => s.timeline))
  const hideNonFixations = $derived(bulk.common(s => s.hideNonFixations ?? false))
  const hideEvents = $derived(bulk.common(s => s.hideEvents ?? false))

  const isOrdinal = $derived(!timeline.mixed && timeline.value === 'ordinal')
  const stimulusHasEvents = $derived(
    hasEventsForStimulus(engine, settings.stimulusId)
  )
  const stimulusHasSegments = $derived(engine.capabilities.segmented)
  // Events ride as an overlay on the gaze segments; not shown in the
  // segment-index-based ordinal view.
  const showHideEvents = $derived(stimulusHasEvents && !isOrdinal)
  const showHideNonFixations = $derived(stimulusHasSegments)
  const timelineSummary = $derived(
    timeline.mixed
      ? 'Mixed'
      : timeline.value
        ? timeline.value.charAt(0).toUpperCase() + timeline.value.slice(1)
        : ''
  )
</script>

<PaneSection title="Visualisation" summary={timelineSummary}>
  <div class="sub-group">
    <div class="legend">Timeline mode</div>
    <Select
      options={[
        { label: 'Absolute', value: 'absolute' },
        { label: 'Relative', value: 'relative' },
        { label: 'Ordinal', value: 'ordinal' },
      ]}
      value={timeline.value}
      mixed={timeline.mixed}
      onchange={e => {
        const v = (e as CustomEvent<string>)
          .detail as ScarfPlotSettings['timeline']
        bulk.update({ timeline: v })
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
          checked={hideNonFixations.value}
          mixed={hideNonFixations.mixed}
          onchange={e =>
            bulk.update({ hideNonFixations: (e as CustomEvent<boolean>).detail })}
        />
      {/if}
      {#if showHideEvents}
        <InputCheck
          label="Events"
          appearance="compact"
          size="xs"
          checked={hideEvents.value}
          mixed={hideEvents.mixed}
          onchange={e =>
            bulk.update({ hideEvents: (e as CustomEvent<boolean>).detail })}
        />
      {/if}
    </div>
  {/if}
</PaneSection>

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
