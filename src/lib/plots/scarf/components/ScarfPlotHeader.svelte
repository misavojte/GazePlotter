<script lang="ts">
  import { ScarfPlotButtonMenu } from '$lib/plots/scarf/components'
  import Select, {
    type GroupSelectItem,
  } from '$lib/shared/components/GeneralSelect.svelte'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
  import { handleScarfSelectionChange } from '../utils/scarfSelectService'
  import { onDestroy } from 'svelte'
  import { data } from '$lib/gaze-data/front-process/stores/dataStore'
  import type { MinorGroupItem } from '$lib/shared/components/GeneralButtonMinor.svelte'
  import Minor from '$lib/shared/components/GeneralButtonMinor.svelte'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'
  import ZoomOut from 'lucide-svelte/icons/zoom-out'
  import RefreshCcw from 'lucide-svelte/icons/refresh-ccw'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/gaze-data/front-process/stores/dataStore'

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
    handleScarfSelectionChange(
      settings,
      { stimulusId },
      source,
      onWorkspaceCommand
    )
  }

  function onTimelineChange(event: CustomEvent) {
    const timeline = event.detail as 'absolute' | 'relative' | 'ordinal'
    handleScarfSelectionChange(
      settings,
      { timeline },
      source,
      onWorkspaceCommand
    )
  }

  function onGroupChange(event: CustomEvent) {
    const groupId = parseInt(event.detail)
    handleScarfSelectionChange(
      settings,
      { groupId },
      source,
      onWorkspaceCommand
    )
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
