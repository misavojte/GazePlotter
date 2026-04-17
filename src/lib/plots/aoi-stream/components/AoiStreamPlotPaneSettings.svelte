<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Radio, Select } from '$lib/shared/components'
  import { ColorGradientPicker } from '$lib/color'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
    getColorScaleCommitted,
    buildColorScalePatch,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { RIDGELINE_SCALE } from '../const'
  import type {
    AoiStreamPlotItem,
    AoiStreamPlotSettings,
  } from '../types'

  interface Props {
    item: AoiStreamPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<AoiStreamPlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  const alignment = $derived(settings.alignment ?? 'stream')
  const isRidgeline = $derived(alignment === 'ridgeline')
  const isHeatmap = $derived(alignment === 'heatmap')

  const colorFields = $derived(
    getColorScaleCommitted(
      settings.colorScale,
      PRESET_PALETTES.HEAT.colors[0],
      PRESET_PALETTES.HEAT.colors[2]
    )
  )

  let colorMin = $state(colorFields.colorMin)
  let colorMiddle = $state(colorFields.colorMiddle)
  let colorMax = $state(colorFields.colorMax)

  let syncingFromProps = false
  $effect(() => {
    syncingFromProps = true
    colorMin = colorFields.colorMin
    colorMiddle = colorFields.colorMiddle
    colorMax = colorFields.colorMax
    queueMicrotask(() => (syncingFromProps = false))
  })
  $effect(() => {
    if (syncingFromProps) return
    const draft = { colorMin, colorMiddle, colorMax }
    const patch = buildColorScalePatch(draft, colorFields)
    if (patch) update({ colorScale: patch })
  })
</script>

<PaneSection title="Filters" alwaysOpen>
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
</PaneSection>

<PaneSection title="View">
  <Radio
    ariaLabel="View"
    options={[
      { label: 'Stream', value: 'stream' },
      { label: 'Distribution', value: 'distribution' },
      { label: 'Ridgeline', value: 'ridgeline' },
      { label: 'Heatmap', value: 'heatmap' },
    ]}
    appearance="compact"
    value={alignment}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as AoiStreamPlotSettings['alignment']
      update({ alignment: v })
    }}
  />
</PaneSection>

<PaneSection title="Binning">
  <InputNumber
    id="aoi-stream-bin-size"
    label="Bin size [ms]"
    value={settings.binSize ?? 500}
    min={1}
    appearance="compact"
    onValueChange={v => update({ binSize: v ?? 500 })}
  />
</PaneSection>

{#if isRidgeline}
  <PaneSection title="Ridgeline">
    <InputNumber
      id="aoi-stream-ridge-scale"
      label="Ridge scale"
      value={settings.ridgelineScale ?? RIDGELINE_SCALE}
      min={1}
      max={10}
      step={0.1}
      appearance="compact"
      onValueChange={v => update({ ridgelineScale: v ?? RIDGELINE_SCALE })}
    />
  </PaneSection>
{/if}

<PaneSection title="Time range [ms]">
  <div class="inline-pair">
    <InputNumber
      id="aoi-stream-timeline-start"
      label="Start"
      value={settings.timelineStart}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineStart: v })}
    />
    <InputNumber
      id="aoi-stream-timeline-end"
      label="End (0 = Auto)"
      value={settings.timelineEnd}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineEnd: v })}
    />
  </div>
</PaneSection>

{#if isHeatmap}
  <PaneSection title="Colors">
    <ColorGradientPicker bind:colorMin bind:colorMiddle bind:colorMax />
  </PaneSection>
{/if}

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
