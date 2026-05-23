<script lang="ts">
  import type { MenuComponentBridgeProps, MenuItem } from '$lib/context-menu'
  import type { ScarfDisplayMode } from '$lib/plots/scarf/types'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import {
    InputCheck,
    InputNumber,
    Radio,
  } from '$lib/shared/components'

  interface Props extends MenuComponentBridgeProps {
    item: MenuItem
    syncs: {
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
      ordinalStart: { value: number | undefined }
      ordinalEnd: { value: number | undefined }
      hideNonFixations: { value: boolean }
      displayMode: { value: ScarfDisplayMode | undefined }
    }
    stimulusHasEvents?: boolean
    stimulusHasSegments?: boolean
  }

  const props: Props = $props()
  const { item, syncs, close, stimulusHasEvents = false, stimulusHasSegments = true } = props

  const eventDisplayOptions = [
    { value: 'segments', label: 'None' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'events', label: 'Only events' },
  ]

  // Local non-undefined mirror for the Radio bind:value (Radio rejects undefined)
  let eventDisplayValue = $state(props.syncs.displayMode.value ?? 'overlay')

  // Sync: external → local
  $effect(() => {
    const v = syncs.displayMode.value
    if (v !== undefined) eventDisplayValue = v
  })

  // Sync: local → external
  $effect(() => {
    syncs.displayMode.value = eventDisplayValue as ScarfDisplayMode
  })

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }

  function setRangeValue(
    boundary: 'start' | 'end',
    nextValue: number | undefined
  ) {
    if (isOrdinal) {
      if (boundary === 'start') {
        syncs.ordinalStart.value = nextValue
      } else {
        syncs.ordinalEnd.value = nextValue
      }
      return
    }

    if (boundary === 'start') {
      syncs.timelineStart.value = nextValue
    } else {
      syncs.timelineEnd.value = nextValue
    }
  }

  const isOrdinal = $derived('value' in item && item.value === 'ordinal')
  const isRelative = $derived('value' in item && item.value === 'relative')
  const showEventDisplayRadio = $derived(stimulusHasEvents && !isOrdinal)
  const showHideNonFixations = $derived(stimulusHasSegments && (isOrdinal || eventDisplayValue !== 'events'))
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    <CompactSettingsSection
      title={isRelative
        ? 'Calculated from Time Range [ms]'
        : isOrdinal
          ? 'Ordinal Range [indices]'
          : 'Time Range [ms]'}
    >
      <div class="timeline-inputs">
        <InputNumber
          id="timeline-start"
          label="Start"
          value={isOrdinal ? syncs.ordinalStart.value : syncs.timelineStart.value}
          min={0}
          placeholder="0"
          appearance="compact"
          allowEmpty={true}
          onValueChange={nextValue => {
            setRangeValue('start', nextValue)
          }}
        />
        <InputNumber
          id="timeline-end"
          label="End (0 = Auto)"
          value={isOrdinal ? syncs.ordinalEnd.value : syncs.timelineEnd.value}
          min={0}
          placeholder="Auto"
          appearance="compact"
          allowEmpty={true}
          onValueChange={nextValue => {
            setRangeValue('end', nextValue)
          }}
        />
      </div>
    </CompactSettingsSection>
    {#if showHideNonFixations}
      <CompactSettingsSeparator tone="light" margin={4} />

      <div class="settings-row">
        <InputCheck
          label="Hide non-fixations"
          appearance="compact"
          size="xs"
          checked={syncs.hideNonFixations.value}
          onchange={event => {
            syncs.hideNonFixations.value = event.detail
          }}
        />
      </div>
    {/if}

    {#if showEventDisplayRadio}
      <CompactSettingsSeparator tone="light" margin={4} />
      <Radio
        legend="Event display"
        options={eventDisplayOptions}
        appearance="compact"
        bind:value={eventDisplayValue}
      />
    {/if}
  </form>
</div>

<style>
  .settings-container {
    box-sizing: border-box;
    padding: 2px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .timeline-inputs {
    display: flex;
    gap: 8px;
  }
  .settings-row {
    display: flex;
    align-items: center;
  }
</style>
