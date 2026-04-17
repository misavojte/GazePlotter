<script lang="ts">
  import { untrack } from 'svelte'
  import { createMenuComponentItem } from '$lib/context-menu'

  import {
    EvolvingMetricsFigure,
    EvolvingMetricsButtonMenu,
  } from '$lib/plots/evolving-metrics/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import GroupSelect from '$lib/shared/components/GroupSelect.svelte'
  import type { GroupSelectItem } from '$lib/shared/components'

  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
  import { getEvolvingMetricsData } from '../core'
  import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'

  import type {
    EvolvingMetricsItem,
    EvolvingMetricsSettings,
  } from '$lib/plots/evolving-metrics/types'
  import type { EvolvingMetricsResult } from '../types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import {
    PreviewModel,
    createMenuCloseHandler,
    getColorScaleCommitted,
    buildColorScalePatch,
    deriveEffectiveColorScale,
  } from '$lib/plots/shared'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import EvolvingMetricsViewSettings from './EvolvingMetricsViewSettings.svelte'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  type EvolvingMetricsPreview = {
    stepSize: number
    windowMultiplier: number
    presentation: string
    colorMin: string
    colorMiddle: string
    colorMax: string
    timelineStart: number | undefined
    timelineEnd: number | undefined
  }

  const preview = new PreviewModel<
    EvolvingMetricsPreview,
    Partial<EvolvingMetricsSettings>
  >({
    getCommitted: () => ({
      stepSize: settings.stepSize ?? 100,
      windowMultiplier: settings.windowMultiplier ?? 1,
      presentation: settings.presentation ?? 'heatmap',
      ...getColorScaleCommitted(
        settings.colorScale,
        PRESET_PALETTES.HEAT.colors[0],
        PRESET_PALETTES.HEAT.colors[2]
      ),
      timelineStart: settings.timelineStart,
      timelineEnd: settings.timelineEnd,
    }),
    buildPatch: (draft, committed) => {
      const updates = PreviewModel.buildSimplePatch(draft, committed, [
        'stepSize',
        'windowMultiplier',
        'timelineStart',
        'timelineEnd',
      ]) as Partial<EvolvingMetricsSettings>

      if (draft.presentation !== committed.presentation) {
        updates.presentation = draft.presentation as 'heatmap' | 'overlay'
      }

      const colorScale = buildColorScalePatch(draft, committed)
      if (colorScale) updates.colorScale = colorScale

      return updates
    },
  })

  const syncs = preview.fields

  const effectiveColorScale = $derived(deriveEffectiveColorScale(preview.draft))

  const effectiveSettings = $derived.by(() => {
    const draft = preview.draft

    return {
      ...settings,
      stepSize: draft.stepSize,
      windowMultiplier: draft.windowMultiplier,
      presentation: draft.presentation as 'heatmap' | 'overlay',
      colorScale: effectiveColorScale,
      timelineStart: draft.timelineStart,
      timelineEnd: draft.timelineEnd,
    }
  })

  // --- DERIVED PIPELINE ---

  const source = $derived.by(() =>
    createCommandSourcePlotPattern(item, 'plot')
  )

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, effectiveSettings.stimulusId)
  )

  const timelineMaxValue = $derived.by(() => {
    if ((effectiveSettings.timelineEnd ?? 0) > 0)
      return effectiveSettings.timelineEnd!

    const participants = getParticipants(
      engine,
      effectiveSettings.groupId,
      effectiveSettings.stimulusId
    )
    return participants.reduce(
      (max, participant) =>
        Math.max(
          max,
          getParticipantEndTime(
            engine,
            effectiveSettings.stimulusId,
            participant.id
          )
        ),
      0
    )
  })

  // --- DATA PIPELINE ---
  let resultData = $state<EvolvingMetricsResult | null>(null)

  $effect(() => {
    const s = effectiveSettings
    const tMax = timelineMaxValue
    const meta = engine.metadata
    void item.redrawTimestamp

    if (!meta) return

    untrack(() => {
      resultData = getEvolvingMetricsData(engine, {
        ...s,
        timelineMin: s.timelineStart ?? 0,
        timelineMax: tMax,
      })
    })
  })

  // --- ACTIONS ---

  const handleMenuClose = createMenuCloseHandler(preview, patch =>
    workspace.updateItemSettings(item.id, patch, $state.snapshot(source))
  )

  const handleStimulusChange = (event: CustomEvent<string>) => {
    const stimulusId = parseInt(event.detail)
    preview.resetAll()

    if (settings.stimulusId === stimulusId) return
    workspace.updateItemSettings(item.id, { stimulusId }, source)
  }

  const handleGroupChange = (event: CustomEvent<string>) => {
    const groupId = parseInt(event.detail)
    preview.resetAll()

    if (settings.groupId === groupId) return
    workspace.updateItemSettings(item.id, { groupId }, source)
  }

  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: stimulusOptions,
      value: effectiveSettings.stimulusId.toString(),
      onchange: handleStimulusChange,
    },
    {
      label: 'Group',
      options: groupOptions,
      value: effectiveSettings.groupId.toString(),
      onchange: handleGroupChange,
    },
    {
      label: 'View',
      value: 'fixationDuration',
      onchange: () => {},
      onClose: handleMenuClose,
      options: [
        createMenuComponentItem({
          value: 'fixationDuration',
          label: 'Fixation duration',
          onAction: () => {},
          closeOnAction: false,
          component: EvolvingMetricsViewSettings,
          componentHeight: 380,
          componentProps: {
            syncs,
          },
        }),
      ],
    },
  ])
</script>

<BasePlot {item} hasData={!!resultData}>
  {#snippet header()}
    <div class="plot-controls">
      <GroupSelect ariaLabel="Evolving metrics filters" items={selectItems} />
      <div class="menu-button">
        <EvolvingMetricsButtonMenu {item} />
      </div>
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    {#if resultData}
      <EvolvingMetricsFigure
        {width}
        {height}
        data={resultData}
        alignment={effectiveSettings.presentation ?? 'heatmap'}
        colorScale={effectiveSettings.colorScale}
      />
    {/if}
  {/snippet}
</BasePlot>

<style>
  .menu-button {
    display: flex;
    align-items: center;
  }
</style>
