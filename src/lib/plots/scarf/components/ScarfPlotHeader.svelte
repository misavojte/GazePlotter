<script lang="ts">
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/data/engine'
  import {
    getParticipantsGroupOptions,
    getStimuliOptions,
  } from '$lib/plots/shared'
  import { PreviewSync } from '$lib/plots/shared'
  import Minor, {
    type MinorGroupItem,
  } from '$lib/shared/components/GeneralButtonMinor.svelte'
  import Select, {
    type GroupSelectItem,
  } from '$lib/shared/components/GeneralSelect.svelte'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import RefreshCcw from 'lucide-svelte/icons/refresh-ccw'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'
  import ZoomOut from 'lucide-svelte/icons/zoom-out'
  import { ScarfPlotButtonMenu } from './'
  import ScarfPlotTimelineSettings from './ScarfPlotTimelineSettings.svelte'
  import { untrack } from 'svelte'

  interface Props {
    settings: ScarfGridType
    source: string
    onWorkspaceCommand: (command: WorkspaceCommand) => void
    syncs: {
      timelineStart: PreviewSync<number>
      timelineEnd: PreviewSync<number>
      ordinalStart: PreviewSync<number>
      ordinalEnd: PreviewSync<number>
      timeline: PreviewSync<'absolute' | 'relative' | 'ordinal'>
    }
    // We still keep a close handler if needed, but managing syncs is cleaner
    onMenuClose?: () => void
  }

  let { settings, source, onWorkspaceCommand, syncs, onMenuClose }: Props =
    $props()

  function calculateActualMax(stimulusId: number): number {
    const participants = getParticipants(settings.groupId, stimulusId)
    const participantIds = participants.map(p => p.id)
    if (settings.timeline === 'absolute') {
      return participantIds.reduce(
        (max, participantId) =>
          Math.max(max, getParticipantEndTime(stimulusId, participantId)),
        0
      )
    } else if (settings.timeline === 'ordinal') {
      return participantIds.reduce(
        (max, participantId) =>
          Math.max(max, getNumberOfSegments(stimulusId, participantId)),
        0
      )
    }
    return 100
  }

  const ZOOM_PERCENTAGE = 15

  function updateTimelineRange(action: 'zoomIn' | 'zoomOut' | 'reset') {
    const stimulusId = settings.stimulusId
    const isOrdinal = settings.timeline === 'ordinal'
    if (settings.timeline === 'relative') return

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

    const updates: Partial<ScarfGridType> = isOrdinal
      ? { ordinalStart: min, ordinalEnd: max }
      : { timelineStart: min, timelineEnd: max }

    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: updates,
      source,
    })
  }

  const isRelativeTimeline = $derived(settings.timeline === 'relative')
  const isResetDisabled = $derived.by(() => {
    if (isRelativeTimeline) return true
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
  let stimuliOptions = $derived(getStimuliOptions())

  // Keep group options in sync with data store
  let participantsGroupOptions = $derived(getParticipantsGroupOptions())

  function onStimulusChange(event: CustomEvent) {
    const stimulusId = parseInt(event.detail)
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: { stimulusId },
      source,
    })
  }

  function onGroupChange(event: CustomEvent) {
    const groupId = parseInt(event.detail)
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: { groupId },
      source,
    })
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
      label: 'Timeline',
      value: settings.timeline,
      onClose: onMenuClose,
      options: [
        {
          value: 'absolute',
          label: 'Absolute',
          onSelect: v => {
            syncs.timeline.value = v
          },
          closeOnAction: false,
          component: ScarfPlotTimelineSettings,
          componentHeight: 145, // Adjust as needed
          componentProps: {
            syncs,
          },
        },
        {
          value: 'relative',
          label: 'Relative',
          onSelect: v => {
            syncs.timeline.value = v
          },
          closeOnAction: false,
          component: ScarfPlotTimelineSettings,
          componentHeight: 80,
          componentProps: {
            syncs,
          },
        },
        {
          value: 'ordinal',
          label: 'Ordinal',
          onSelect: v => {
            syncs.timeline.value = v
          },
          closeOnAction: false,
          component: ScarfPlotTimelineSettings,
          componentHeight: 120,
          componentProps: {
            syncs,
          },
        },
      ],
    },
  ])
</script>

<div class="nav">
  <Select
    ariaLabel="Scarf filters"
    items={selectItems}
    label="Scarf"
    options={[]}
  />
  <Minor items={groupItems} ariaLabel="Zoom controls" />
  <ScarfPlotButtonMenu {settings} {onWorkspaceCommand} />
</div>

<style>
  .nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
