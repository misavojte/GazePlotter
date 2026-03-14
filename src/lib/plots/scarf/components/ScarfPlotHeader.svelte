<script lang="ts">
  import { createMenuComponentItem } from '$lib/context-menu'
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/data/engine'
  import {
    getParticipantsGroupOptions,
    getStimuliOptions,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import Minor, {
    type MinorGroupItem,
  } from '$lib/shared/components/GeneralButtonMinor.svelte'
  import Select from '$lib/shared/components/GeneralSelectGroup.svelte'
  import type { GroupSelectItem } from '$lib/shared/components'
  import { getWorkspaceService } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { ScarfPlotItem, ScarfPlotSettings } from '$lib/plots/scarf/types'
  import RefreshCcw from 'lucide-svelte/icons/refresh-ccw'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'
  import ZoomOut from 'lucide-svelte/icons/zoom-out'
  import { ScarfPlotButtonMenu } from './'
  import ScarfPlotViewSettings from './ScarfPlotViewSettings.svelte'

  interface Props {
    item: ScarfPlotItem
    settings: ScarfPlotSettings
    syncs: {
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
      ordinalStart: { value: number | undefined }
      ordinalEnd: { value: number | undefined }
      timeline: { value: 'absolute' | 'relative' | 'ordinal' }
      hideNonFixations: { value: boolean }
    }
    // We still keep a close handler if needed, but managing syncs is cleaner
    onMenuClose?: () => void
  }

  let { item, settings, syncs, onMenuClose }: Props = $props()
  const { engine } = getGazePlotterSession()
  const workspace = getWorkspaceService()
  const source = $derived(createCommandSourcePlotPattern(item, 'plot'))

  function calculateActualMax(stimulusId: number): number {
    const participants = getParticipants(engine, settings.groupId, stimulusId)
    const participantIds = participants.map(p => p.id)
    if (settings.timeline === 'absolute') {
      return participantIds.reduce(
        (max, participantId) =>
          Math.max(max, getParticipantEndTime(engine, stimulusId, participantId)),
        0
      )
    } else if (settings.timeline === 'ordinal') {
      return participantIds.reduce(
        (max, participantId) =>
          Math.max(max, getNumberOfSegments(engine, stimulusId, participantId)),
        0
      )
    }
    return 100
  }

  const ZOOM_PERCENTAGE = 15

  function updateTimelineRange(action: 'zoomIn' | 'zoomOut' | 'reset') {
    const stimulusId = settings.stimulusId
    const isOrdinal = settings.timeline === 'ordinal'
    if (settings.timeline === 'relative' && action !== 'reset') return

    // Fallback to legacy structure if new globals aren't set
    const currentStart = isOrdinal
      ? (settings.ordinalStart ??
        settings.ordinalStimuliLimits?.[stimulusId]?.[0] ??
        0)
      : (settings.timelineStart ??
        settings.absoluteStimuliLimits?.[stimulusId]?.[0] ??
        0)

    const currentEnd = isOrdinal
      ? (settings.ordinalEnd ??
        settings.ordinalStimuliLimits?.[stimulusId]?.[1] ??
        0)
      : (settings.timelineEnd ??
        settings.absoluteStimuliLimits?.[stimulusId]?.[1] ??
        0)

    let min = currentStart
    let max = currentEnd

    if (action === 'reset') {
      min = 0
      max = 0
    } else {
      if (max === 0) max = calculateActualMax(stimulusId)
      const range = max - min
      const delta = isOrdinal
        ? Math.ceil((range * ZOOM_PERCENTAGE) / 100)
        : (range * ZOOM_PERCENTAGE) / 100

      if (action === 'zoomIn') {
        if (isOrdinal ? range - delta * 2 < 2 : range - delta * 2 < range * 0.1)
          return
        min = Math.max(0, min + delta)
        max -= delta
      } else {
        min = Math.max(0, min - delta)
        max += delta
      }
    }

    const updates: Partial<ScarfPlotSettings> = isOrdinal
      ? { ordinalStart: min, ordinalEnd: max }
      : { timelineStart: min, timelineEnd: max }

    workspace.updateItemSettings(item.id, updates, source)
  }

  const isRelativeTimeline = $derived(settings.timeline === 'relative')
  const isResetDisabled = $derived.by(() => {
    if (settings.timeline === 'ordinal') {
      return (
        (settings.ordinalStart ?? 0) === 0 && (settings.ordinalEnd ?? 0) === 0
      )
    }
    return (
      (settings.timelineStart ?? 0) === 0 && (settings.timelineEnd ?? 0) === 0
    )
  })

  let groupItems = $derived<MinorGroupItem[]>([
    {
      icon: ZoomIn,
      onclick: () => updateTimelineRange('zoomIn'),
      isDisabled: isRelativeTimeline,
      ariaLabel: 'Zoom in',
      tooltip: 'Zoom in',
    },
    {
      icon: ZoomOut,
      onclick: () => updateTimelineRange('zoomOut'),
      isDisabled: isRelativeTimeline,
      ariaLabel: 'Zoom out',
      tooltip: 'Zoom out',
    },
    {
      icon: RefreshCcw,
      onclick: () => updateTimelineRange('reset'),
      isDisabled: isResetDisabled,
      ariaLabel: 'Reset view',
      tooltip: 'Reset scarf plot view',
    },
  ])

  // ---------------------------
  // Grouped selects (Stimulus, Timeline, Group)
  // ---------------------------
  let stimuliOptions = $derived(getStimuliOptions(engine))

  // Keep group options in sync with data store
  let participantsGroupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  function onStimulusChange(event: CustomEvent) {
    const stimulusId = parseInt(event.detail)
    workspace.updateItemSettings(
      item.id,
      { stimulusId },
      source
    )
  }

  function onGroupChange(event: CustomEvent) {
    const groupId = parseInt(event.detail)
    workspace.updateItemSettings(item.id, { groupId }, source)
  }

  // Single grouped selects in order: Stimulus, Group, Timeline
  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: stimuliOptions,
      value: settings.stimulusId.toString(),
      onchange: onStimulusChange,
    },
    {
      label: 'Group',
      options: participantsGroupOptions,
      value: settings.groupId.toString(),
      onchange: onGroupChange,
    },
    {
      label: 'View',
      value: settings.timeline,
      onClose: onMenuClose,
      options: [
        createMenuComponentItem({
          value: 'absolute',
          label: 'Absolute',
          onSelect: v => {
            syncs.timeline.value = v as ScarfPlotSettings['timeline']
          },
          closeOnAction: false,
          component: ScarfPlotViewSettings,
          componentHeight: 145, // Adjust as needed
          componentProps: {
            syncs,
          },
        }),
        createMenuComponentItem({
          value: 'relative',
          label: 'Relative',
          onSelect: v => {
            syncs.timeline.value = v as ScarfPlotSettings['timeline']
          },
          closeOnAction: false,
          component: ScarfPlotViewSettings,
          componentHeight: 145,
          componentProps: {
            syncs,
          },
        }),
        createMenuComponentItem({
          value: 'ordinal',
          label: 'Ordinal',
          onSelect: v => {
            syncs.timeline.value = v as ScarfPlotSettings['timeline']
          },
          closeOnAction: false,
          component: ScarfPlotViewSettings,
          componentHeight: 120,
          componentProps: {
            syncs,
          },
        }),
      ],
    },
  ])
</script>

<div class="nav">
  <Select ariaLabel="Scarf filters" items={selectItems} />
  <Minor items={groupItems} ariaLabel="Zoom controls" />
  <ScarfPlotButtonMenu {item} />
</div>

<style>
  .nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
