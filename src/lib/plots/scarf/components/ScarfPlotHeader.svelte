<script lang="ts">
  import { ScarfPlotButtonMenu } from '$lib/plots/scarf/components'
  import Select, { type GroupSelectItem } from '$lib/shared/components/GeneralSelect.svelte'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import { handleScarfSelectionChange } from '../utils/scarfSelectService'
  import { onDestroy } from 'svelte'
  import { data, getParticipantsGroups } from '$lib/gaze-data/front-process/stores/dataStore'
  import Minor, { type MinorGroupItem } from '$lib/shared/components/GeneralButtonMinor.svelte'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'
  import ZoomOut from 'lucide-svelte/icons/zoom-out'
  import RefreshCcw from 'lucide-svelte/icons/refresh-ccw'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  
  interface Props {
    settings: ScarfGridType
    source: string,
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, source, onWorkspaceCommand }: Props = $props()

  function calculateActualMax(stimulusId: number): number {
    const participants = getParticipants(settings.groupId, stimulusId)
    const participantIds = participants.map(p => p.id)
    if (settings.timeline === 'absolute') {
      return participantIds.reduce(
        (max, participantId) => Math.max(max, getParticipantEndTime(stimulusId, participantId)),
        0
      )
    } else if (settings.timeline === 'ordinal') {
      return participantIds.reduce(
        (max, participantId) => Math.max(max, getNumberOfSegments(stimulusId, participantId)),
        0
      )
    }
    return 100
  }

  const ZOOM_PERCENTAGE = 15

  function handleZoomIn() {
    const stimulusId = settings.stimulusId
    let updated: Partial<ScarfGridType> = {}
    if (settings.timeline === 'absolute') {
      const limits = settings.absoluteStimuliLimits[stimulusId] || [0, 0]
      const min = limits[0]
      const max = limits[1] === 0 ? calculateActualMax(stimulusId) : limits[1]
      const range = max - min
      const delta = (range * ZOOM_PERCENTAGE) / 100
      if (range - delta * 2 < range * 0.1) return
      const newMin = Math.max(0, min + delta)
      const newMax = max - delta
      const updatedLimits = { ...settings.absoluteStimuliLimits }
      updatedLimits[stimulusId] = [newMin, newMax]
      updated = { absoluteStimuliLimits: updatedLimits }
    } else if (settings.timeline === 'ordinal') {
      const limits = settings.ordinalStimuliLimits[stimulusId] || [0, 0]
      const min = limits[0]
      const max = limits[1] === 0 ? calculateActualMax(stimulusId) : limits[1]
      const range = max - min
      const delta = Math.ceil((range * ZOOM_PERCENTAGE) / 100)
      if (range - delta * 2 < 2) return
      const newMin = Math.max(0, min + delta)
      const newMax = max - delta
      const updatedLimits = { ...settings.ordinalStimuliLimits }
      updatedLimits[stimulusId] = [newMin, newMax]
      updated = { ordinalStimuliLimits: updatedLimits }
    } else {
      return
    }
    onWorkspaceCommand({ type: 'updateSettings', itemId: settings.id, settings: updated, source })
  }

  function handleZoomOut() {
    const stimulusId = settings.stimulusId
    let updated: Partial<ScarfGridType> = {}
    if (settings.timeline === 'absolute') {
      const limits = settings.absoluteStimuliLimits[stimulusId] || [0, 0]
      const min = limits[0]
      const max = limits[1] === 0 ? calculateActualMax(stimulusId) : limits[1]
      const range = max - min
      const delta = (range * ZOOM_PERCENTAGE) / 100
      const newMin = Math.max(0, min - delta)
      const newMax = max + delta
      const updatedLimits = { ...settings.absoluteStimuliLimits }
      updatedLimits[stimulusId] = [newMin, newMax]
      updated = { absoluteStimuliLimits: updatedLimits }
    } else if (settings.timeline === 'ordinal') {
      const limits = settings.ordinalStimuliLimits[stimulusId] || [0, 0]
      const min = limits[0]
      const max = limits[1] === 0 ? calculateActualMax(stimulusId) : limits[1]
      const range = max - min
      const delta = Math.ceil((range * ZOOM_PERCENTAGE) / 100)
      const newMin = Math.max(0, min - delta)
      const newMax = max + delta
      const updatedLimits = { ...settings.ordinalStimuliLimits }
      updatedLimits[stimulusId] = [newMin, newMax]
      updated = { ordinalStimuliLimits: updatedLimits }
    } else {
      return
    }
    onWorkspaceCommand({ type: 'updateSettings', itemId: settings.id, settings: updated, source })
  }

  function handleReset() {
    const stimulusId = settings.stimulusId
    let updated: Partial<ScarfGridType> = {}
    if (settings.timeline === 'absolute') {
      const updatedLimits = { ...settings.absoluteStimuliLimits }
      updatedLimits[stimulusId] = [0, 0]
      updated = { absoluteStimuliLimits: updatedLimits }
    } else if (settings.timeline === 'ordinal') {
      const updatedLimits = { ...settings.ordinalStimuliLimits }
      updatedLimits[stimulusId] = [0, 0]
      updated = { ordinalStimuliLimits: updatedLimits }
    } else {
      return
    }
    onWorkspaceCommand({ type: 'updateSettings', itemId: settings.id, settings: updated, source })
  }

  const isRelativeTimeline = $derived(settings.timeline === 'relative')
  const isResetDisabled = $derived((() => {
    const stimulusId = settings.stimulusId
    if (settings.timeline === 'absolute') {
      const limits = settings.absoluteStimuliLimits[stimulusId]
      return !limits || (limits[0] === 0 && limits[1] === 0)
    }
    if (settings.timeline === 'ordinal') {
      const limits = settings.ordinalStimuliLimits[stimulusId]
      return !limits || (limits[0] === 0 && limits[1] === 0)
    }
    return true
  })())

  let groupItems = $derived<MinorGroupItem[]>([
    { icon: ZoomIn, onclick: handleZoomIn, isDisabled: isRelativeTimeline, ariaLabel: 'Zoom in', tooltip: 'Zoom in' },
    { icon: ZoomOut, onclick: handleZoomOut, isDisabled: isRelativeTimeline, ariaLabel: 'Zoom out', tooltip: 'Zoom out' },
    { icon: RefreshCcw, onclick: handleReset, isDisabled: isResetDisabled, ariaLabel: 'Reset view', tooltip: 'Reset scarf plot view' },
  ])

  // ---------------------------
  // Grouped selects (Stimulus, Timeline, Group)
  // ---------------------------
  let selectedStimulusId = $state(settings.stimulusId.toString())
  let stimuliOptions = $state<{ label: string; value: string }[]>(getStimuliOptions())

  let selectedTimeline = $state(settings.timeline)
  const timelineOptions = [
    { value: 'absolute', label: 'Absolute' },
    { value: 'relative', label: 'Relative' },
    { value: 'ordinal', label: 'Ordinal' },
  ]

  let selectedGroupId = $state(settings.groupId.toString())
  let groupOptions: { value: string; label: string }[] = $state([])

  // Sync from settings
  $effect(() => {
    selectedStimulusId = settings.stimulusId.toString()
    stimuliOptions = getStimuliOptions()
    selectedTimeline = settings.timeline
    selectedGroupId = settings.groupId.toString()
  })

  // Keep group options in sync with data store
  const unsubscribe = data.subscribe(() => {
    groupOptions = getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
  })
  onDestroy(() => unsubscribe())

  function onStimulusChange(event: CustomEvent) {
    const stimulusId = parseInt(event.detail)
    selectedStimulusId = stimulusId.toString()
    handleScarfSelectionChange(settings, { stimulusId }, source, onWorkspaceCommand)
  }

  function onTimelineChange(event: CustomEvent) {
    const timeline = event.detail as 'absolute' | 'relative' | 'ordinal'
    selectedTimeline = timeline
    handleScarfSelectionChange(settings, { timeline }, source, onWorkspaceCommand)
  }

  function onGroupChange(event: CustomEvent) {
    const groupId = parseInt(event.detail)
    selectedGroupId = groupId.toString()
    handleScarfSelectionChange(settings, { groupId }, source, onWorkspaceCommand)
  }

  // Single grouped selects in order: Stimulus, Group, Timeline
  const selectItems = $derived<GroupSelectItem[]>([
    { label: 'Stimulus', options: stimuliOptions, value: selectedStimulusId, onchange: onStimulusChange },
    { label: 'Group', options: groupOptions, value: selectedGroupId, onchange: onGroupChange },
    { label: 'Timeline', options: timelineOptions, value: selectedTimeline, onchange: onTimelineChange },
  ])

</script>

<div class="nav">
  <Select ariaLabel="Scarf filters" items={selectItems} label="Scarf" options={[]} />
  <Minor items={groupItems} ariaLabel="Zoom controls" />
  <ScarfPlotButtonMenu
    {settings}
    {onWorkspaceCommand}
  />
</div>

<style>
  .nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
