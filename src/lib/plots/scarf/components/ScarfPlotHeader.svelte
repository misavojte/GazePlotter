<script lang="ts">
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/gaze-data/front-process'
  import {
    getParticipantsGroupOptions,
    getStimuliOptions,
  } from '$lib/plots/shared'
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

  interface Props {
    settings: ScarfGridType
    source: string
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, source, onWorkspaceCommand }: Props = $props()

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

    const limits = (isOrdinal
      ? settings.ordinalStimuliLimits
      : settings.absoluteStimuliLimits)[stimulusId] || [0, 0]
    let [min, max] = limits

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

    const updatedLimits = {
      ...(isOrdinal
        ? settings.ordinalStimuliLimits
        : settings.absoluteStimuliLimits),
    }
    updatedLimits[stimulusId] = [min, max]

    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: isOrdinal
        ? { ordinalStimuliLimits: updatedLimits }
        : { absoluteStimuliLimits: updatedLimits },
      source,
    })
  }

  const isRelativeTimeline = $derived(settings.timeline === 'relative')
  const isResetDisabled = $derived.by(() => {
    if (isRelativeTimeline) return true
    const limits = (
      settings.timeline === 'ordinal'
        ? settings.ordinalStimuliLimits
        : settings.absoluteStimuliLimits
    )[settings.stimulusId]
    return !limits || (limits[0] === 0 && limits[1] === 0)
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

  const timelineOptions = [
    { value: 'absolute', label: 'Absolute' },
    { value: 'relative', label: 'Relative' },
    { value: 'ordinal', label: 'Ordinal' },
  ]

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

  function onTimelineChange(event: CustomEvent) {
    const timeline = event.detail as 'absolute' | 'relative' | 'ordinal'
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: { timeline },
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
      options: timelineOptions,
      value: settings.timeline,
      onchange: onTimelineChange,
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
