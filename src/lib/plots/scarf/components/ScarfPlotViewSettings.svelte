<script lang="ts">
  import type { MenuComponentBridgeProps, MenuItem } from '$lib/context-menu'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import {
    InputCheck,
    InputNumber,
  } from '$lib/shared/components'

  interface Props extends MenuComponentBridgeProps {
    item: MenuItem
    syncs: {
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
      ordinalStart: { value: number | undefined }
      ordinalEnd: { value: number | undefined }
      hideNonFixations: { value: boolean }
    }
  }

  let { item, syncs, close }: Props = $props()

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
