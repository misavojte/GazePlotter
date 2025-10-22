<script lang="ts">
  import {
    ScarfPlotSelectStimulus,
    ScarfPlotSelectTimeline,
    ScarfPlotSelectGroup,
    ScarfPlotButtonMenu,
    ScarfPlotButtonZoomIn,
    ScarfPlotButtonZoomOut,
    ScarfPlotButtonResetView,
  } from '$lib/plots/scarf/components'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceInstruction } from '$lib/shared/types/workspaceInstructions'
  
  interface Props {
    settings: ScarfGridType
    onSettingsChange: (settings: Partial<ScarfGridType>) => void
    onInstruction: (instruction: WorkspaceInstruction) => void
  }

  let { settings, onSettingsChange, onInstruction }: Props = $props()

</script>

<div class="nav">
  <ScarfPlotSelectStimulus {settings} {onSettingsChange} />
  <ScarfPlotSelectTimeline {settings} {onSettingsChange} />
  <ScarfPlotSelectGroup {settings} {onSettingsChange} />
  <ScarfPlotButtonZoomIn {settings} {onSettingsChange} />
  <ScarfPlotButtonZoomOut {settings} {onSettingsChange} />
  <ScarfPlotButtonResetView {settings} {onSettingsChange} />
  <ScarfPlotButtonMenu
    {settings}
    {onInstruction}
    {onSettingsChange}
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
