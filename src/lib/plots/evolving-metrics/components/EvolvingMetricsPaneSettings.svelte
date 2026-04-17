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
  import { multiplierToMs } from '../core'
  import type { EvolvingMetricsItem, EvolvingMetricsSettings } from '../types'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<EvolvingMetricsSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  const presentation = $derived(settings.presentation ?? 'heatmap')
  const isHeatmap = $derived(presentation === 'heatmap')

  const step = $derived(settings.stepSize ?? 100)
  const n = $derived(settings.windowMultiplier ?? 1)
  const windowMs = $derived(multiplierToMs(n, step))

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

  // External -> local sync + local -> committed. buildColorScalePatch
  // returns null when draft matches committed, so the round-trip
  // self-terminates — no microtask-gated flag needed.
  $effect(() => {
    colorMin = colorFields.colorMin
    colorMiddle = colorFields.colorMiddle
    colorMax = colorFields.colorMax
  })
  $effect(() => {
    const patch = buildColorScalePatch(
      { colorMin, colorMiddle, colorMax },
      colorFields
    )
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
    ariaLabel="Presentation"
    options={[
      { label: 'Heatmap', value: 'heatmap' },
      { label: 'Overlay', value: 'overlay' },
    ]}
    appearance="compact"
    direction="row"
    value={presentation}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as 'heatmap' | 'overlay'
      update({ presentation: v })
    }}
  />
</PaneSection>

<PaneSection title="Window">
  <InputNumber
    id="ev-step-size"
    label="Step size [ms]"
    value={step}
    min={1}
    appearance="compact"
    onValueChange={v => update({ stepSize: v ?? step })}
  />
  <div class="window-row">
    <InputNumber
      id="ev-window-multiplier"
      label="SW multiplier (2n+1)"
      value={n}
      min={0}
      step={1}
      appearance="compact"
      onValueChange={v => update({ windowMultiplier: v ?? n })}
    />
    <span class="window-value">{n > 0 ? `${windowMs} ms` : 'off'}</span>
  </div>
</PaneSection>

<PaneSection title="Time range [ms]" defaultOpen={false}>
  <div class="inline-pair">
    <InputNumber
      id="ev-timeline-start"
      label="Start"
      value={settings.timelineStart}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineStart: v })}
    />
    <InputNumber
      id="ev-timeline-end"
      label="End (0 = Auto)"
      value={settings.timelineEnd}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineEnd: v })}
    />
  </div>
</PaneSection>

<!-- Keep the picker always mounted regardless of presentation mode:
     wrapping `bind:` on a component in an `{#if}` block breaks the
     upstream write path (the picker remounts with stale bindings and
     its writes never reach parent state, so colorScale commits are
     silently lost). See AoiStream/ScanpathSimilarity for the same
     workaround. -->
<div style:display={isHeatmap ? 'contents' : 'none'}>
  <PaneSection title="Colors">
    <ColorGradientPicker bind:colorMin bind:colorMiddle bind:colorMax />
  </PaneSection>
</div>

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
  .window-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .window-value {
    font-size: 11px;
    color: var(--c-darkgrey);
    padding-bottom: 6px;
    white-space: nowrap;
  }
</style>
