<script lang="ts">
  import {
    ScarfPlotSelectStimulus,
    ScarfPlotSelectTimeline,
    ScarfPlotSelectGroup,
    ScarfPlotButtonMenu,
  } from '$lib/plots/scarf/components'
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

</script>

<div class="nav">
  <ScarfPlotSelectStimulus {settings} {source} {onWorkspaceCommand} />
  <ScarfPlotSelectTimeline {settings} {source} {onWorkspaceCommand} />
  <ScarfPlotSelectGroup {settings} {source} {onWorkspaceCommand} />
  <Minor items={groupItems} ariaLabel="Zoom controls" />
  <ScarfPlotButtonMenu
    {settings}
    {onWorkspaceCommand}
  />
</div>

<style>
  .nav {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
